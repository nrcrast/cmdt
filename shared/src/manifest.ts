/**
 * Shared data structures intended to represent a DASH/HLS agnostic manifest interface
 */

import type { Scte35Marker } from "./report.js";
import { SegmentCache } from "./segment-cache.js";

export abstract class ManifestParser {
	abstract parse(manifest: string, manifestUrl: string, baseUrl?: string): Promise<Manifest>;
}

export type DownloadableChunkOptions = {
	partial?: boolean;
};

export abstract class DownloadableChunk {
	constructor(public url: URL) {}
	abstract download(opts?: DownloadableChunkOptions): Promise<void>;
	abstract getData(): Promise<ArrayBuffer | null>;
	abstract free(): void;
}

export class MemoryCachedChunk extends DownloadableChunk {
	public async download(opts?: { partial?: boolean }): Promise<void> {
		if (SegmentCache.getInstance().get(this.url)) {
			return;
		}
		const fetchOpts = opts?.partial ? { headers: { Range: "bytes=0-6480" } } : {};
		const resp = await fetch(this.url.href, fetchOpts);
		const data = await resp.arrayBuffer();
		SegmentCache.getInstance().add(this.url, data);
	}

	public async getData(): Promise<ArrayBuffer | null> {
		await this.download();
		return SegmentCache.getInstance().get(this.url);
	}
	public free(): void {
		SegmentCache.getInstance().remove(this.url);
	}
}

export type Segment = {
	/* Start time in milliseconds */
	startTime: number;
	/* Duration in milliseconds */
	duration: number;
	url: URL;
	initSegment?: DownloadableChunk;
	media?: DownloadableChunk;
	/* Base media decode time in milliseconds */
	baseMediaDecodeTime?: number;
	/**
	 * Media duration in MS
	 * derived from the trun mp4 box
	 */
	mediaDuration?: number;
	/**
	 * For DASH this is the raw time not adjusted for the presentation time offset in milliseconds
	 */
	rawSegmentTime?: number;
	/**
	 * Index of the content protection in the manifest
	 */
	contentProtectionIds?: Array<number>;
	isLastInPeriod?: boolean;
	isFirstInPeriod?: boolean;
};

export type Period = {
	id?: string;
	start: number;
	absoluteStartMs?: number;
	baseUrl?: Array<string>;
	startString?: string;
	segmentsAvailable: number;
	duration: number;
	end: number;
	startPrevEnd: boolean;
	periodOverlap: boolean;
};

export enum MediaType {
	Video = "video",
	Audio = "audio",
	Image = "image",
	Text = "text",
	Unknown = "unknown",
}

export interface BaseRepresentation {
	segments: Array<Segment>;
	id: string;
	width?: number;
	height?: number;
	bandwidth?: number;
	type: MediaType;
	hasCaptions: {
		cea608: boolean;
		cea708: boolean;
	};
	codecs?: string;
	language?: string;
	numChannels?: number;
	spatialAudio?: boolean;
}

export interface ImageRepresentation extends BaseRepresentation {
	type: MediaType.Image;
	imageRows: number;
	imageCols: number;
}

export type Representation = BaseRepresentation | ImageRepresentation;

export class UniqueRepresentationMap extends Map<string, Representation> {
	public add(representation: Representation) {
		const newSegments = representation.segments.sort((a, b) => a.startTime - b.startTime);
		const first = newSegments[0];
		const last = newSegments[newSegments.length - 1];
		if (first && last) {
			first.isFirstInPeriod = true;
			last.isLastInPeriod = true;
		}

		const existing = this.get(representation.id);
		if (!existing) {
			this.set(representation.id, representation);
			return;
		}
		existing.segments.push(...newSegments);
		existing.segments.sort((a, b) => a.startTime - b.startTime);
		if (representation.hasCaptions.cea608) {
			existing.hasCaptions.cea608 = true;
		}
		if (representation.hasCaptions.cea708) {
			existing.hasCaptions.cea708 = true;
		}
	}

	toArray(): Array<Representation> {
		return Array.from(this.values());
	}

	toJSON() {
		return this.toArray();
	}
}

export enum DrmSystem {
	WIDEVINE = "widevine",
	PLAYREADY = "playready",
	FAIRPLAY = "fairplay",
	NONE = "none",
	UNKNOWN = "unknown",
}

export type ContentProtection = {
	systemId: string;
	type: DrmSystem;
	pssh?: string;
	// biome-ignore lint/suspicious/noExplicitAny: parsedPssh is a DrmSystem specific object
	parsedPssh?: any;
	cencDefaultKid?: string;
};

export type Manifest = {
	url: URL;
	video: UniqueRepresentationMap;
	audio: UniqueRepresentationMap;
	images: UniqueRepresentationMap;
	text: UniqueRepresentationMap;
	scte35?: Array<Scte35Marker>;
	contentProtection: Array<ContentProtection>;
	captionStreamToLanguage: Record<string, string>;
	periods: Array<Period>;
	raw: string;
};

export function getMediaTypeFromMimeType(mimeType: string): MediaType {
	if (mimeType.startsWith("video")) {
		return MediaType.Video;
	}
	if (mimeType.startsWith("audio")) {
		return MediaType.Audio;
	}
	if (mimeType.startsWith("text")) {
		return MediaType.Text;
	}
	if (mimeType.startsWith("image")) {
		return MediaType.Image;
	}
	return MediaType.Video;
}
