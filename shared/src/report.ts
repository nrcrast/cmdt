import type { Cue } from "./cue.js";
import type { Manifest, Representation, Segment } from "./manifest.js";

export type RepresentationId = string;

export type Emsg = {
	id: number;
	eventDuration: number;
	timescale: number;
	presentationTimeDelta: number;
	schemeIdUri: string;
	value: string;
	messageData: Uint8Array | string;
};

export enum MismatchedContentProtectionType {
	ManifestMissing = "manifestMissing",
	MediaMissing = "mediaMissing",
	Mismatch = "mismatch",
}

export type MismatchedContentProtectionEntry = {
		type:  MismatchedContentProtectionType.Mismatch;
		detectedInMedia?: string[]; // Base 64 encoded PSSHs
		expectedInManifest?: string[]; // Base 64 encoded PSSHs
		segment: Segment;
	} | {
		type: MismatchedContentProtectionType.ManifestMissing;
		detectedInMedia: string[]; // Base 64 encoded PSSHs
		segment: Segment;
	} | {
		type: MismatchedContentProtectionType.MediaMissing;
		expectedInManifest: string[]; // Base 64 encoded PSSHs
		segment: Segment;
	};

export type Report = {
	missingCues: {
		[representation: RepresentationId]: {
			[cue: string]: Array<RepresentationId>;
		};
	};
	duplicateThumbnails: {
		[representation: RepresentationId]: {
			[thumbnail: string]: Set<RepresentationId>;
		};
	};
	gaps: {
		[mediaType: string]: {
			[representation: string]: Array<{ expectedStartTime: number; previousSegment: Segment; segment: Segment }>;
		};
	};
	decodeTimeMismatches: Array<Segment>;
	durationMismatches: Array<Segment>;
	emsgs: {
		[representation: RepresentationId]: {
			segment: Segment;
			emsgs: Array<Emsg>;
		};
	};
	// biome-ignore lint/complexity/noBannedTypes: The type is passthrough
	mediaStreamValidator?: Object;
	// biome-ignore lint/complexity/noBannedTypes: The type is passthrough
	dashConformance?: Object;
	manifest: Omit<Manifest, "video" | "audio" | "images"| "raw"> & {
		video: Array<Representation>;
		audio: Array<Representation>;
		images: Array<Representation>;
	};
	captions?: {
		[stream: string]: Array<Cue>;
	};
	mismatchedContentProtection: Array<MismatchedContentProtectionEntry>
};
