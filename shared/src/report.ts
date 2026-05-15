import type { SCTE35 } from "scte35";
import type { VTTData } from "webvtt-parser";
import type { Cue } from "./cue.js";
import type { Manifest, Representation, Segment } from "./manifest.js";
import type { Emsg } from "./utils/mp4/types.js";

export type RepresentationId = string;

export enum MismatchedContentProtectionType {
	ManifestMissing = "manifestMissing",
	MediaMissing = "mediaMissing",
	Mismatch = "mismatch",
}

export type Scte35Marker = {
	presentationTimeS: number;
	data: ReturnType<typeof SCTE35.prototype.parseFromB64>;
};

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
	manifest: Omit<Manifest, "video" | "audio" | "images" | "text" | "raw"> & {
		video: Array<Representation>;
		audio: Array<Representation>;
		images: Array<Representation>;
		text: Array<Representation>;
	};
	captions?: {
		[stream: string]: Array<Cue>;
	};
	textCues: Pick<VTTData, "cues" | "styles">;
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
				text: [],
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
			textCues: {
				cues: [],
				styles: [],
			},
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
		this.raw.textCues.cues.sort((a, b) => a.startTime - b.startTime);
		return this.raw;
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
	public addVttCues(cues: VTTData) {
		this.raw.textCues.cues.push(...cues.cues);
		this.raw.textCues.styles.push(...cues.styles);
	}
	public ingestManifest(manifest: Manifest) {
		const { video, audio, images, text, ...rest } = manifest;
		this.raw.manifest = {
			...rest,
			video: video.toArray(),
			audio: audio.toArray(),
			images: images.toArray(),
			text: text.toArray(),
		};
	}
}
