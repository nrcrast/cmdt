import type { Cue } from "./cue.js";
import type { Manifest, Representation, Segment } from "./manifest.js";
import type { Emsg } from "./utils/mp4/types.js";

export type RepresentationId = string;

export enum MismatchedContentProtectionType {
	ManifestMissing = "manifestMissing",
	MediaMissing = "mediaMissing",
	Mismatch = "mismatch",
}

export type MismatchedContentProtectionEntry =
	| {
			type: MismatchedContentProtectionType.Mismatch;
			// biome-ignore lint/suspicious/noExplicitAny: parsedPssh is a DrmSystem specific object
			detectedInMedia?: { pssh: string; parsedPssh: any }[];
			// biome-ignore lint/suspicious/noExplicitAny: parsedPssh is a DrmSystem specific object
			expectedInManifest?: { pssh: string; parsedPssh: any }[];
			segment: Segment;
	  }
	| {
			type: MismatchedContentProtectionType.ManifestMissing;
			detectedInMedia: string[]; // Base 64 encoded PSSHs
			segment: Segment;
	  }
	| {
			type: MismatchedContentProtectionType.MediaMissing;
			expectedInManifest: string[]; // Base 64 encoded PSSHs
			segment: Segment;
	  };

export type RawReport = {
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
	manifest: Omit<Manifest, "video" | "audio" | "images" | "raw"> & {
		video: Array<Representation>;
		audio: Array<Representation>;
		images: Array<Representation>;
	};
	captions?: {
		[stream: string]: Array<Cue>;
	};
	mismatchedContentProtection: Array<MismatchedContentProtectionEntry>;
};

export class Report {
	private raw: RawReport;
	constructor() {
		this.raw = {
			missingCues: {},
			duplicateThumbnails: {},
			manifest: {
				url: new URL("http://localhost"), // Placeholder
				video: [],
				audio: [],
				images: [],
				captionStreamToLanguage: {},
				periods: [],
				contentProtection: [],
			},
			mismatchedContentProtection: [],
			decodeTimeMismatches: [],
			durationMismatches: [],
			gaps: {},
			emsgs: {},
			captions: {},
		};
	}
	public addMissingCue(targetRepresentation: string, candidateRepresentation: string, cueId: string) {
		if (!this.raw.missingCues[targetRepresentation]) {
			this.raw.missingCues[targetRepresentation] = {};
		}
		if (!this.raw.missingCues[targetRepresentation][cueId]) {
			this.raw.missingCues[targetRepresentation][cueId] = [];
		}
		this.raw.missingCues[targetRepresentation][cueId].push(candidateRepresentation);
	}
	public getRaw() {
		return this.raw;
	}
	// biome-ignore lint/complexity/noBannedTypes: The type is passthrough
	public setMediaStreamValidatorReport(report: Object) {
		this.raw.mediaStreamValidator = report;
	}
	// biome-ignore lint/complexity/noBannedTypes: The type is passthrough
	public setDashConformanceReport(report: Object) {
		this.raw.dashConformance = report;
	}
	public addCaptionStream(stream: string, captions: Array<Cue>) {
		if (!this.raw.captions) {
			this.raw.captions = {};
		}
		this.raw.captions[stream] = captions;
	}
	public addGap(representation: Representation, expectedStartTime: number, previousSegment: Segment, segment: Segment) {
		let gapsForType = this.raw.gaps[representation.type];
		if (!gapsForType) {
			gapsForType = {};
			this.raw.gaps[representation.type] = gapsForType;
		}
		let gapsForRepresentation = gapsForType[representation.id];
		if (!gapsForRepresentation) {
			gapsForRepresentation = [];
			gapsForType[representation.id] = gapsForRepresentation;
		}
		gapsForRepresentation.push({ expectedStartTime, previousSegment, segment });
	}
	public addDecodeTimeMismatch(segment: Segment) {
		this.raw.decodeTimeMismatches.push(segment);
	}
	public addDurationMismatch(segment: Segment) {
		this.raw.durationMismatches.push(segment);
	}
	public addDuplicateThumbnail(targetRepresentation: string, candidateThumbnailId: string, thumbnailId: string) {
		if (!this.raw.duplicateThumbnails[targetRepresentation]) {
			this.raw.duplicateThumbnails[targetRepresentation] = {};
		}
		if (!this.raw.duplicateThumbnails[targetRepresentation][thumbnailId]) {
			this.raw.duplicateThumbnails[targetRepresentation][thumbnailId] = new Set<string>();
		}
		this.raw.duplicateThumbnails[targetRepresentation][thumbnailId].add(candidateThumbnailId);
	}
	public addMismatchedContentProtection(entry: MismatchedContentProtectionEntry) {
		this.raw.mismatchedContentProtection.push(entry);
	}
	public addEsmg(representation: Representation, segment: Segment, emsg: Emsg) {
		let emsgsForRepresentation = this.raw.emsgs[representation.id];
		if (!emsgsForRepresentation) {
			emsgsForRepresentation = {
				segment,
				emsgs: [],
			};
			this.raw.emsgs[representation.id] = emsgsForRepresentation;
		}
		emsgsForRepresentation.emsgs.push(emsg);
	}
	public ingestManifest(manifest: Manifest) {
		const { video, audio, images, ...rest } = manifest;
		this.raw.manifest = {
			...rest,
			video: video.toArray(),
			audio: audio.toArray(),
			images: images.toArray(),
		};
	}
}
