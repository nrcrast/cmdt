import { Factory } from "fishery";
import { type Manifest, MediaType, UniqueRepresentationMap } from "cmdt-shared";
import { representationFactory } from "./representation.js";

type TransientParams = {
	numVideoRepresentations?: number;
	numAudioRepresentations?: number;
	numImageRepresentations?: number;
	numSegments?: number;
};

const startingResolution = {
	width: 320,
	height: 240,
};
const startingBitrate = 100000;

export const manifestFactory = Factory.define<Manifest, TransientParams>(({ transientParams }) => {
	const manifest: Manifest = {
		url: new URL("https://example.com/manifest.mpd"),
		video: new UniqueRepresentationMap(),
		audio: new UniqueRepresentationMap(),
		images: new UniqueRepresentationMap(),
		captionStreamToLanguage: {},
		periods: [],
		raw: "",
	};

	if (transientParams.numVideoRepresentations) {
		for (let i = 0; i < transientParams.numVideoRepresentations; i++) {
			const width = startingResolution.width * (i + 1);
			const height = startingResolution.height * (i + 1);
			const bandwidth = startingBitrate * (i + 1);
			manifest.video.add(
				representationFactory.build(
					{ type: MediaType.Video, width, height, bandwidth },
					{ transient: { numSegments: transientParams.numSegments ?? 10 } },
				),
			);
		}
	}
	if (transientParams.numAudioRepresentations) {
		for (let i = 0; i < transientParams.numAudioRepresentations; i++) {
			const bandwidth = startingBitrate * (i + 1);
			manifest.audio.add(
				representationFactory.build(
					{ type: MediaType.Audio, bandwidth },
					{ transient: { numSegments: transientParams.numSegments ?? 10 } },
				),
			);
		}
	}
	if (transientParams.numImageRepresentations) {
		for (let i = 0; i < transientParams.numImageRepresentations; i++) {
			const bandwidth = startingBitrate * (i + 1);
			const width = startingResolution.width * (i + 1);
			const height = startingResolution.height * (i + 1);
			manifest.images.add(
				representationFactory.build(
					{ type: MediaType.Image, bandwidth, width, height },
					{ transient: { numSegments: transientParams.numSegments ?? 10 } },
				),
			);
		}
	}

	return manifest;
});
