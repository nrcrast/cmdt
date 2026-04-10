import fs from "node:fs/promises";
import path from "node:path";
import cliProgress from "cli-progress";
import { Manifest, MediaType, Segment } from "cmdt-shared";
import type winston from "winston";
import { getOpts } from "../../cli-opts.js";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { canAccessFile } from "../../utils/file.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { Emsg, ParsedBox } from "../../utils/mp4/types.js";

export class EmsgExtractor {
	private logger: winston.Logger;
	constructor() {
		this.logger = getLogger();
	}
	public async extractEmsgFromDownloadedSegments(manifest: Manifest, report: Report): Promise<void> {
		const mp4Parser = new Mp4Parser();
		this.logger.info("Extracting emsgs...");
		const showProgress = ["info", "debug"].includes(getOpts().logLevel);
		const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	
		const nSegments = manifest.video.toArray().reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0) + manifest.audio.toArray().reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0);
		const representations = [...manifest.video.toArray(), ...manifest.audio.toArray()];
		if (showProgress) {
			progress.start(nSegments, 0);
		}
		for(const representation of representations) {
		for (const segmentMetadata of representation.segments) {
			if (!segmentMetadata) {
				if (showProgress) {
					progress.increment();
				}
				continue;
			}
			const segment = await segmentMetadata.media?.getData();
			if (!segment) {
				if (showProgress) {
					progress.increment();
				}
				continue;
			}

			mp4Parser
				.fullBox("emsg", (box: ParsedBox) => {
					const parsedEmsgBox: Emsg = Mp4Parser.parseEmsg(box);
					try {
						const strData = new TextDecoder("utf-8").decode(parsedEmsgBox.messageData as Uint8Array);
						parsedEmsgBox.messageData = strData;
					} catch (e) {
						this.logger.error(`Failed to decode emsg message data: ${e}`);
					}
					report.addEsmg(representation, segmentMetadata, parsedEmsgBox);
				})
				.box("moov", (box: ParsedBox) => {
					Mp4Parser.children(box);
				})
				.parse(new Uint8Array(segment).buffer);

			if (showProgress) {
				progress.increment();
			}
		}
		}

		progress.stop();
	}
}
