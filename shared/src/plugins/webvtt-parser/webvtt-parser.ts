import type { Manifest, Representation, Segment } from "../../manifest.js";
import { MediaType } from "../../manifest.js";
import type { Report } from "../../report.js";
import { WebVTTParser } from 'webvtt-parser';
import { Plugin } from "../plugin.js";

export class WebVttParser extends Plugin {
	private parser: WebVTTParser;
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "webvtt-parser");
		this.parser = new WebVTTParser();
	}
	public override async processSegment(segmentMetadata: Segment, representation: Representation): Promise<void> {
		if(representation.type !== MediaType.Text) {
			return;
		}
		const segment = await segmentMetadata.media?.getData();
		if (!segment) {
			return;
		}
		const cues = this.parser.parse(segment);
		console.log(cues);
	}
}
