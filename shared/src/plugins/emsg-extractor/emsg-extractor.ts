import type { Manifest, Representation, Segment } from "../../manifest.js";
import type { Report } from "../../report.js";
import Mp4Parser from "../../utils/mp4/mp4-parser.js";
import type { Emsg, ParsedBox } from "../../utils/mp4/types.js";
import { Plugin } from "../plugin.js";

export class EmsgExtractor extends Plugin {
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "emsg-extractor");
	}
	public override async processSegment(segmentMetadata: Segment, representation: Representation): Promise<void> {
		const mp4Parser = new Mp4Parser();

		const segment = await segmentMetadata.media?.getData();
		if (!segment) {
			return;
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
				this.report.addEsmg(representation, segmentMetadata, parsedEmsgBox);
			})
			.box("moov", (box: ParsedBox) => {
				Mp4Parser.children(box);
			})
			.parse(new Uint8Array(segment).buffer);
	}
}
