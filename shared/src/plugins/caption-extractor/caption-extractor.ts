import type { Cue } from "../../cue.js";
import type { Manifest, Representation, Segment } from "../../manifest.js";
import type { Report } from "../../report.js";
import { CeaSchemeUri } from "../../utils/types.js";
import { Plugin, type PluginArtifact } from "../plugin.js";
import CeaParser from "./cea/parser.js";

export type Captions = Record<string, { stream: string; cues: Array<Cue> }>;

export class CaptionExtractor extends Plugin {
	private captions: Captions = {};
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "caption-extractor");
	}
	public override async processSegment(segment: Segment, representation: Representation): Promise<void> {
		if (!representation.hasCaptions.cea608 && !representation.hasCaptions.cea708) {
			return;
		}

		const captionUri = representation.hasCaptions.cea608 ? CeaSchemeUri.CEA608 : CeaSchemeUri.CEA708;
		const parsers = new Map<string, CeaParser>();

		if (!segment.initSegment || !segment.media) {
			return;
		}
		const [initSegmentData, segmentData] = await Promise.all([segment.initSegment.getData(), segment.media.getData()]);
		if (!initSegmentData || !segmentData) {
			return;
		}
		let parser: CeaParser | undefined;

		if (!parsers.has(segment.initSegment?.url.href)) {
			parser = new CeaParser();
			try {
				const initSegment = initSegmentData;
				parser.parse({ data: new Uint8Array(initSegment).buffer, id: 0, periodId: "0" }, captionUri);
				parsers.set(segment.initSegment.url.href, parser);
			} catch (e) {
				parser = new CeaParser();
				this.logger.warn(`Failed to parse init segment: ${e}`);
			}
		}

		parser = parsers.get(segment.initSegment.url.href);
		let captions: Array<Cue> = [];
		try {
			captions =
				parser?.parse({ data: new Uint8Array(segmentData).buffer, id: segment.startTime, periodId: "0" }, captionUri) ??
				[];
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

	public override async finalize() {
		this.validate();
		const artifacts: Array<PluginArtifact> = [];
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
			artifacts.push({
				name: filename,
				content: JSON.stringify(this.captions[captionStream]?.cues, null, 2),
			});
		}
		return artifacts;
	}

	private validate() {
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
