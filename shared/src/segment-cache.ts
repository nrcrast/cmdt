export class SegmentCache {
	private static cache?: SegmentCache;
	private segments: Map<URL, ArrayBuffer>;
	constructor() {
		this.segments = new Map();
	}
	public add(url: URL, data: ArrayBuffer) {
		this.segments.set(url, data);
	}
	public get(url: URL): ArrayBuffer | null {
		return this.segments.get(url) ?? null;
	}
	public remove(url: URL): void {
		this.segments.delete(url);
	}
	public static getInstance(): SegmentCache {
		if (!SegmentCache.cache) {
			SegmentCache.cache = new SegmentCache();
		}
		return SegmentCache.cache;
	}
}
