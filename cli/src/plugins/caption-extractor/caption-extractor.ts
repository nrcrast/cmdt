import fs from "node:fs/promises";
import path from "node:path";
import cliProgress from "cli-progress";
import type { Cue, Manifest } from "cmdt-shared";
import { mkdirp } from "mkdirp";
import type winston from "winston";
import { getOpts } from "../../cli-opts.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import CeaParser from "../../text/cea/parser.js";
import { CeaSchemeUri } from "../../utils/manifest/types.js";

export type Captions = Record<string, { stream: string; cues: Array<Cue> }>;

export class CaptionExtractor {
	private captions: Captions = {};
	private logger: winston.Logger;
	constructor(
		private manifest: Manifest,
		private report: Report,
	) {
		this.logger = getLogger();
	}
	public async extractFromDownloadedSegments(): Promise<Captions> {
		this.captions = {};
		this.logger.info("Extracting captions...");
		const showProgress = ["info", "debug"].includes(getOpts().logLevel);
		const captionsProgress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

		const numSegments = this.manifest.video.toArray().reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0);
		if (showProgress) {
			captionsProgress.start(numSegments, 0);
		}
		await mkdirp(path.resolve(getOpts().output, "captions"));

		for (const representation of this.manifest.video.values()) {
			const captionUri = representation.hasCaptions.cea608 ? CeaSchemeUri.CEA608 : CeaSchemeUri.CEA708;
			const parsers = new Map<string, CeaParser>();
			for (const segment of representation.segments) {
				if (showProgress) {
					captionsProgress.increment();
				}
				if (!segment.initSegmentFilesystemPath || !segment.fileSystemPath) {
					continue;
				}
				try {
					await Promise.all([
						fs.access(segment.initSegmentFilesystemPath, fs.constants.R_OK | fs.constants.W_OK),
						fs.access(segment.fileSystemPath, fs.constants.R_OK | fs.constants.W_OK),
					]);
					// biome-ignore lint/correctness/noUnusedVariables: do not care about the error here
				} catch (e) {
					// files don't exist
					continue;
				}
				let parser: CeaParser | undefined;

				if (!parsers.has(segment.initSegmentFilesystemPath)) {
					parser = new CeaParser();
					try {
						const initSegment = await fs.readFile(path.resolve(segment.initSegmentFilesystemPath));
						parser.parse({ data: new Uint8Array(initSegment).buffer, id: 0, periodId: "0" }, captionUri);
						parsers.set(segment.initSegmentFilesystemPath, parser);
					} catch (e) {
						parser = new CeaParser();
						this.logger.warn(`Failed to parse init segment: ${e}`);
					}
				}

				parser = parsers.get(segment.initSegmentFilesystemPath);
				const segmentData = await fs.readFile(path.resolve(segment.fileSystemPath));
				let captions: Array<Cue> = [];
				try {
					captions =
						parser?.parse(
							{ data: new Uint8Array(segmentData).buffer, id: segment.startTime, periodId: "0" },
							captionUri,
						) ?? [];
				} catch (e) {
					this.logger.warn(`Failed to parse segment: ${e}`);
				}

				for (const caption of captions) {
					const stream = caption.id.split("_").pop() ?? "unknown";
					const key = `${stream}_${representation.id.replaceAll("/", "-")}`;
					if (!this.captions[key]) {
						this.captions[key] = { stream, cues: [] };
					}
					this.captions[key]?.cues.push(caption);
				}
			}
		}
		await this.write();
		captionsProgress.stop();
		return this.captions;
	}

	private async write() {
		for (const captionStream of Object.keys(this.captions)) {
			const rawStream = this.captions[captionStream]?.stream;
			if (!rawStream) {
				continue;
			}
			const lang = this.manifest.captionStreamToLanguage[rawStream];
			let filename = `captions-${captionStream}.json`;
			if (lang) {
				filename = `captions-${lang}-${captionStream}.json`;
			}
			this.report.addCaptionStream(captionStream, this.captions[captionStream]?.cues ?? []);
			const capsFile = path.resolve(getOpts().output, "captions", filename);
			await fs.mkdir(path.dirname(capsFile), { recursive: true });
			await fs.writeFile(capsFile, JSON.stringify(this.captions[captionStream]?.cues, null, 2));
		}
	}

	public validate() {
		// Group by streams
		// Key is the stream (or language)
		// Value is an array of cues for each representation
		const captionsByStream: Record<string, Array<{ representation: string; cues: Array<Cue> }>> = {};

		for (const [representation, caption] of Object.entries(this.captions)) {
			if (!captionsByStream[caption.stream]) {
				captionsByStream[caption.stream] = [];
			}
			captionsByStream[caption.stream]?.push({
				representation,
				cues: caption.cues,
			});
		}

		// For a given stream, all representations should have exactly the same cues
		for (const stream of Object.keys(captionsByStream)) {
			const cuesForStream = captionsByStream[stream] ?? [];
			for (let targetIndex = 0; targetIndex < cuesForStream.length; targetIndex += 1) {
				const target = cuesForStream[targetIndex];
				if (!target) {
					this.logger.debug(`No target for ${stream} at index ${targetIndex}`);
					continue;
				}
				for (let i = 1; i < cuesForStream.length; i += 1) {
					if (i === targetIndex) {
						continue;
					}
					const candidate = cuesForStream[i];
					if (!candidate) {
						this.logger.debug(`No candidate for ${target.representation} at index ${i}`);
						continue;
					}
					for (let cueIndex = 0; cueIndex < target.cues.length; cueIndex += 1) {
						const targetCue = target.cues[cueIndex];
						if (!targetCue) {
							continue;
						}
						// Look for the same ID in the candidate
						const candidateCue = candidate.cues.find((c) => c.id === targetCue.id);
						if (!candidateCue) {
							this.report.addMissingCue(target.representation, candidate.representation, targetCue.id);
							this.logger.debug(
								`Cue ${targetCue.id} in ${target.representation} not found in representation ${candidate.representation}`,
							);
						}
					}
				}
			}
		}
	}
}
