import path from "node:path";
import type { Cue, Representation, Segment } from "cmdt-shared";
import { getOpts } from "./cli-opts.js";
import { getUrlFilePath } from "./utils/url.js";

export type DownloadEntry = {
	url: string;
	destDir: string;
	destFile: string;
	segment?: Segment;
	captions?: Array<Cue>;
	representation: Representation;
};

export class DownloadQueue {
	private entries: Array<DownloadEntry> = [];
	private dlDirBase: string;
	private initSegments: Map<string, string> = new Map<string, string>();

	constructor() {
		this.dlDirBase = path.resolve(getOpts().output, "segments");
	}

	public getEntries() {
		return this.entries;
	}

	public addSegment(segment: Segment, representation: Representation) {
		let uriPath = segment.url.pathname;
		if (uriPath.startsWith("/")) {
			uriPath = uriPath.substring(1);
		}
		let destDir = path.resolve(this.dlDirBase, getUrlFilePath(segment.url));
		const destFile = uriPath.split("/").pop() ?? "";
		if (segment.initSegmentUrl && !this.initSegments.has(segment.initSegmentUrl.href)) {
			let initSegmentUriPath = segment.initSegmentUrl.pathname;
			if (initSegmentUriPath.startsWith("/")) {
				initSegmentUriPath = initSegmentUriPath.substring(1);
			}
			destDir = path.resolve(this.dlDirBase, getUrlFilePath(segment.initSegmentUrl));
			const initSegmentFile = initSegmentUriPath.split("/").pop() ?? "";
			this.initSegments.set(segment.initSegmentUrl.href, path.resolve(destDir, initSegmentFile));
			this.entries.push({
				url: segment.initSegmentUrl.href,
				destDir,
				destFile: initSegmentFile,
				representation,
			});
		}
		this.entries.push({
			url: segment.url.href,
			destDir,
			destFile,
			representation,
			segment,
		});
		segment.fileSystemPath = path.resolve(destDir, destFile);
		if (segment.initSegmentUrl) {
			segment.initSegmentFilesystemPath = this.initSegments.get(segment.initSegmentUrl.href);
		}
	}
}
