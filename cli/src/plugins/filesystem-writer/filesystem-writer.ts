import fs from "node:fs/promises";
import path from "node:path";
import { getUrlFilePath, type Manifest, Plugin, type Report, type Segment } from "cmdt-shared";
import { mkdirp } from "mkdirp";
import { getOpts } from "../../cli-opts.js";

export class FilesystemWriter extends Plugin {
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "filesystem-writer");
	}
	public override async processSegment(segment: Segment): Promise<void> {
		if (segment.media?.url) {
			const filename = segment.media.url.pathname.split("/").pop();
			if (!filename) {
				return;
			}
			const segmentFilePath = path.resolve(getOpts().output, getUrlFilePath(segment.media.url));
			const data = await segment.media.getData();
			if (!data) {
				return;
			}
			await mkdirp(path.dirname(segmentFilePath));
			await fs.writeFile(path.resolve(path.dirname(segmentFilePath), filename), Buffer.from(data));
		}
		if (segment.initSegment?.url) {
			const filename = segment.initSegment.url.pathname.split("/").pop();
			if (!filename) {
				return;
			}
			const segmentFilePath = path.resolve(getOpts().output, getUrlFilePath(segment.initSegment.url));
			const data = await segment.initSegment.getData();
			if (!data) {
				return;
			}
			await mkdirp(path.dirname(segmentFilePath));
			await fs.writeFile(path.resolve(path.dirname(segmentFilePath), filename), Buffer.from(data));
		}
	}
}
