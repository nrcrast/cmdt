import { Factory } from "fishery";
import { type Representation, MediaType, type Segment } from "cmdt-shared";
import { segmentFactory } from "./segment.js";

type TransientParams = {
	numSegments?: number;
};

export const representationFactory = Factory.define<Representation, TransientParams>(
	({ transientParams, params, sequence }) => {
		let representation: Representation = {
			id: `${params.type}-${sequence}`,
			segments: [],
			type: MediaType.Video,
			width: 1920,
			height: 1080,
			bandwidth: 5000000,
			hasCaptions: { cea608: false, cea708: false },
			codecs: "avc1.640028",
			language: "eng",
		};
		if (params.type === MediaType.Audio) {
			representation = {
				id: `${params.type}-${sequence}`,
				segments: [],
				type: MediaType.Audio,
				bandwidth: 5000000,
				hasCaptions: { cea608: false, cea708: false },
				codecs: "mp4a.40.2",
				language: "eng",
				numChannels: 2,
				spatialAudio: false,
			};
		} else if (params.type === MediaType.Video) {
			representation = {
				id: `${params.type}-${sequence}`,
				segments: [],
				type: MediaType.Video,
				width: 1920,
				height: 1080,
				bandwidth: 5000000,
				hasCaptions: { cea608: false, cea708: false },
				codecs: "avc1.640028",
				language: "eng",
				numChannels: 2,
				spatialAudio: false,
			} as Representation;
		} else if (params.type === MediaType.Image) {
			representation = {
				id: `${params.type}-${sequence}`,
				segments: [],
				type: MediaType.Image,
				width: 1920,
				height: 1080,
				bandwidth: 5000000,
				hasCaptions: { cea608: false, cea708: false },
				codecs: "avc1.640028",
				language: "eng",
				numChannels: 2,
				spatialAudio: false,
				imageRows: 1,
				imageCols: 1,
			} as Representation;
		}
		if (transientParams.numSegments) {
			representation.segments = segmentFactory.buildList(transientParams.numSegments) as Segment[];
		}
		return representation;
	},
);
