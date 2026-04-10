import type { Segment } from "../../manifest.js";
import { HydratablePlaylist } from "./hydratable-playlist.js";

export enum HlsMediaType {
	AUDIO = "AUDIO",
	VIDEO = "VIDEO",
	SUBTITLES = "SUBTITLES",
	CLOSED_CAPTIONS = "CLOSED-CAPTIONS",
}

export enum SpecialUsageId {
	BINAURAL = "BINAURAL",
	IMMERSIVE = "IMMERSIVE",
	DOWNMIX = "DOWNMIX",
}

export enum VideoRange {
	SDR = "SDR",
	HLG = "HLG",
	PQ = "PQ",
}

export class ExtXMedia extends HydratablePlaylist {
	public groupId?: string;
	public language?: string;
	public assocLanguage?: string;
	public stableRenditionId?: string;
	public default?: boolean;
	public autoselect?: boolean;
	public forced?: boolean;
	public instreamId?: string;
	public bitDepth?: number;
	public sampleRate?: number;
	public characteristics?: Array<string>;
	public channels?: {
		count: number;
		audioCoding?: Array<string>;
		specialUsageIds?: Set<SpecialUsageId>;
	};
	constructor(
		public type: HlsMediaType,
		public name: string,
		uri?: string,
	) {
		super(uri);
	}
}

export class ExtXStreamInf extends HydratablePlaylist {
	public averageBandwidth?: number;
	public score?: number;
	public codecs?: Array<string>;
	public supplementalCodecs?: Array<string>;
	public resolution?: {
		width: number;
		height: number;
	};
	public frameRate?: number;
	public hdcpLevel?: string;
	public allowedCpc?: Array<string>;
	public videoRange?: VideoRange;
	public stableVariantId?: string;
	public audio?: string;
	public video?: string;
	public subtitles?: string;
	public closedCaptions?: string;
	constructor(
		uri: string,
		public bandwidth: number,
	) {
		super(uri);
	}
}

export class ExtXImageStreamInf extends HydratablePlaylist {
	public bandwidth?: number;
	public resolution?: {
		width: number;
		height: number;
	};
}

export type MediaPlaylist = {
	targetDuration: number;
	mediaSequence: number;
	discontinuitySequence: number;
	playlistType: "EVENT" | "VOD";
	iFramesOnly: boolean;
	partialSegmentInfo?: {
		target?: number;
	};
	imageLayout?: {
		rows: number;
		cols: number;
	};
	serverControl?: {
		canSkipUnti?: number;
		canSkipDateRange?: boolean;
		holdBack?: number;
		partHoldBack?: number;
		canBlockReload?: boolean;
	};
	segments: Array<Segment>;
};

export type MasterPlaylist = {
	mediaTags: Array<ExtXMedia>;
	streamInfTags: Array<ExtXStreamInf>;
	imageStreamInfTags: Array<ExtXImageStreamInf>;
};
