import { describe, expect, it } from "vitest";
import {
	type Manifest,
	MediaType,
	type Representation,
	type Segment,
	UniqueRepresentationMap,
} from "../src/manifest.js";
import { getLiveEdgeMs, latestWindowToTimeRange, secondsToTimeRange } from "../src/utils/time-range.js";

function makeRepresentation(type: MediaType, id: string, segments: Array<Pick<Segment, "startTime" | "duration">>) {
	const representation: Representation = {
		id,
		type,
		hasCaptions: { cea608: false, cea708: false },
		segments: segments.map((segment) => ({ ...segment, url: new URL("http://example.com/segment.m4s") })),
	};
	return representation;
}

function makeManifest(options: {
	video?: Array<Pick<Segment, "startTime" | "duration">>;
	audio?: Array<Pick<Segment, "startTime" | "duration">>;
}): Manifest {
	const video = new UniqueRepresentationMap();
	const audio = new UniqueRepresentationMap();
	if (options.video) {
		video.add(makeRepresentation(MediaType.Video, "v0", options.video));
	}
	if (options.audio) {
		audio.add(makeRepresentation(MediaType.Audio, "a0", options.audio));
	}
	return {
		url: new URL("http://example.com/manifest.mpd"),
		isLive: false,
		video,
		audio,
		images: new UniqueRepresentationMap(),
		text: new UniqueRepresentationMap(),
		contentProtection: [],
		captionStreamToLanguage: {},
		periods: [],
		raw: "",
	};
}

describe("getLiveEdgeMs", () => {
	it("returns the greatest video segment end time", () => {
		const manifest = makeManifest({
			video: [
				{ startTime: 0, duration: 6000 },
				{ startTime: 6000, duration: 6000 },
			],
			// Audio extends further, but video anchors the live edge.
			audio: [{ startTime: 0, duration: 20000 }],
		});
		expect(getLiveEdgeMs(manifest)).toBe(12000);
	});

	it("falls back to non-video representations when there is no video", () => {
		const manifest = makeManifest({ audio: [{ startTime: 0, duration: 4000 }] });
		expect(getLiveEdgeMs(manifest)).toBe(4000);
	});

	it("returns 0 for a manifest with no segments", () => {
		expect(getLiveEdgeMs(makeManifest({}))).toBe(0);
	});
});

describe("secondsToTimeRange", () => {
	it("converts seconds to milliseconds and leaves the end open when omitted", () => {
		expect(secondsToTimeRange(5)).toEqual({ start: 5000, end: undefined });
	});

	it("converts both bounds to milliseconds", () => {
		expect(secondsToTimeRange(5, 10)).toEqual({ start: 5000, end: 10000 });
	});
});

describe("latestWindowToTimeRange", () => {
	it("anchors the window to the live edge", () => {
		const manifest = makeManifest({
			video: [
				{ startTime: 0, duration: 6000 },
				{ startTime: 6000, duration: 6000 },
			],
		});
		// Live edge is 12000ms; the latest 6s starts at 6000ms and runs to the edge.
		expect(latestWindowToTimeRange(manifest, 6)).toEqual({ start: 6000 });
	});

	it("clamps the start to zero when the window exceeds the stream length", () => {
		const manifest = makeManifest({ video: [{ startTime: 0, duration: 6000 }] });
		expect(latestWindowToTimeRange(manifest, 3600)).toEqual({ start: 0 });
	});
});
