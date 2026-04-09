import type { Representation, Segment } from "cmdt-shared";

export class DownloadEntry {
	constructor(
		public representation: Representation,
		public segment: Segment,
	) {}
}
export class DownloadQueue {
	private entries: Array<DownloadEntry> = [];

	constructor() {}

	public getEntries() {
		return this.entries;
	}

	public addSegment(segment: Segment, representation: Representation) {
		this.entries.push(new DownloadEntry(representation, segment));
	}
}
