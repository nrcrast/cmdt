import axios from "axios";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getTestFile } from "../../../test/utils.js";
import type { Manifest } from "../../manifest.js";
import { HlsManifest } from "./hls.js";

vi.mock("axios");

describe("HlsManifest", () => {
	it("should parse an HLS manifest", async () => {
		vi.mocked(axios.get).mockImplementation(async (url: string) => {
			return {
				data: await getTestFile(`manifests/hls/${new URL(url).pathname.split("/").pop()}`),
			};
		});
		const manifestUrl = "http://example.com/manifest.m3u8";
		const testManifest = await getTestFile("manifests/hls/master.m3u8");
		const parser = new HlsManifest();
		const manifest = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
	});
	it("should parse an HLS manifest with SCTE markers", async () => {
		vi.mocked(axios.get).mockImplementation(async (url: string) => {
			return {
				data: await getTestFile(`manifests/hls-scte/${url.split("http://example.com/")[1]}`),
			};
		});
		const manifestUrl = "http://example.com/manifest.m3u8";
		const testManifest = await getTestFile("manifests/hls-scte/master.m3u8");
		const parser = new HlsManifest();
		const manifest = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
	});
});

/**
 * Real-world Disney+ HLS VOD manifest (multi-language, DRM, VOD). The master
 * references ~68 child playlists under `r/`; the mock resolves each fetched
 * playlist URL to its on-disk fixture. This manifest is too large for a
 * snapshot, so behavior is asserted explicitly (see the repo test conventions).
 */
describe("HlsManifest — Disney+ VOD (real manifest)", () => {
	let manifest: Manifest;

	beforeAll(async () => {
		vi.mocked(axios.get).mockImplementation(async (url: string) => {
			return {
				data: await getTestFile(`manifests/hls-dplus/${url.split("http://example.com/")[1]}`),
			};
		});
		const manifestUrl = "http://example.com/manifest.m3u8";
		const master = await getTestFile("manifests/hls-dplus/master.m3u8");
		manifest = (await new HlsManifest().parse(master, manifestUrl)).manifest;
	});

	it("parses the expected representation counts", () => {
		expect(manifest.video.toArray()).toHaveLength(6);
		expect(manifest.audio.toArray()).toHaveLength(3);
		expect(manifest.text.toArray()).toHaveLength(10);
		expect(manifest.images.toArray()).toHaveLength(0);
		expect(manifest.scte35).toHaveLength(0);
	});

	it("parses video variants with resolution/codec/bandwidth", () => {
		const video = manifest.video.toArray();
		// Deduped by playlist URI, so the aac-128k and eac-3 variant sets collapse to 6.
		expect(video.map((v) => v.bandwidth)).toEqual([2510768, 1537539, 1165810, 901498, 620734, 360541]);
		expect(video.map((v) => `${v.width}x${v.height}`)).toEqual([
			"1280x720",
			"1280x720",
			"854x480",
			"854x480",
			"640x360",
			"640x360",
		]);
		for (const v of video) {
			expect(v.codecs).toBe("avc1.64001f,mp4a.40.2");
		}
	});

	it("emits segment start times in milliseconds, cumulative from zero", () => {
		const top = manifest.video.get("avc1.64001f-mp4a.40.2-2510768");
		expect(top).toBeDefined();
		const segments = top?.segments ?? [];
		expect(segments).toHaveLength(77);

		// #EXTINF is 8.008s -> durations and start times are milliseconds.
		expect(segments[0]?.startTime).toBe(0);
		expect(segments[0]?.duration).toBeCloseTo(8008, 0);

		// Regression guard: the running start time must NOT be re-converted
		// seconds->ms (which produced 8_008_000 for the second segment).
		expect(segments[1]?.startTime).toBeCloseTo(8008, 0);
		expect(segments[1]?.startTime ?? Number.POSITIVE_INFINITY).toBeLessThan(60_000);

		// Every start time equals the cumulative sum of preceding durations.
		let expectedStart = 0;
		for (const segment of segments) {
			expect(segment.startTime).toBeCloseTo(expectedStart, 3);
			expectedStart += segment.duration;
		}

		expect(segments[0]?.isFirstInPeriod).toBe(true);
		expect(segments.at(-1)?.isLastInPeriod).toBe(true);
	});

	it("attaches the EXT-X-MAP init segment to each media segment", () => {
		const top = manifest.video.get("avc1.64001f-mp4a.40.2-2510768");
		const first = top?.segments[0];
		expect(first?.initSegment).toBeDefined();
		expect(first?.initSegment?.url.href).toContain("map.mp4");
	});

	it("parses subtitle renditions keyed by language with cumulative ms timing", () => {
		expect(manifest.text.toArray().map((t) => t.id)).toEqual([
			"text-zh-HK",
			"text-zh-Hant",
			"text-en",
			"text-el",
			"text-hu",
			"text-ko",
			"text-pl",
			"text-ro",
			"text-es-419",
			"text-tr",
		]);

		const english = manifest.text.get("text-en");
		expect(english).toBeDefined();
		const segments = english?.segments ?? [];
		expect(segments).toHaveLength(22);
		expect(segments[0]?.startTime).toBe(0);
		expect(segments[1]?.startTime).toBeCloseTo(segments[0]?.duration ?? 0, 3);
	});
});

/**
 * Real-world Peacock HLS VOD manifest (CMAF, DRM). Unlike the Disney+ fixture,
 * the master references its audio/video/subtitle playlists with absolute URLs on
 * a separate CDN host, while image playlists use relative URLs; it also carries
 * closed captions, image (trickplay) tracks, and SCTE-35 markers. The mock maps
 * each fetched playlist URL to its on-disk fixture by the path following the
 * content GUID. Too large for a snapshot, so behavior is asserted explicitly.
 */
describe("HlsManifest — Peacock VOD (real manifest)", () => {
	const guid = "696d1c42-8f55-4319-8881-c9ea48b22c8a";
	const masterUrl = `https://g003-vod-us-cmaf-prd-ak.cdn.peacocktv.com/pub/global/ZLW/uBH/GMO_00000000007021_01/kfs_gsp/PCK_1765887961266_e753_01/mpeg_cbcs/${guid}/master_cmaf.m3u8`;
	let manifest: Manifest;

	beforeAll(async () => {
		vi.mocked(axios.get).mockImplementation(async (url: string) => {
			return { data: await getTestFile(`manifests/hls-pck/${url.split(`${guid}/`)[1]}`) };
		});
		const master = await getTestFile("manifests/hls-pck/master_cmaf.m3u8");
		manifest = (await new HlsManifest().parse(master, masterUrl)).manifest;
	});

	it("parses the expected representation counts", () => {
		expect(manifest.video.toArray()).toHaveLength(6);
		expect(manifest.audio.toArray()).toHaveLength(2);
		expect(manifest.text.toArray()).toHaveLength(2);
		expect(manifest.images.toArray()).toHaveLength(3);
		expect(manifest.scte35).toHaveLength(22);
	});

	it("resolves absolute-URL video variants and dedupes shared playlists", () => {
		const video = manifest.video.toArray();
		// Each resolution is listed twice (surround + stereo) but shares one playlist
		// URL, so the six unique variants collapse to the first (surround/ec-3) of each.
		expect(video.map((v) => v.bandwidth)).toEqual([2354081, 11723161, 3756565, 2842229, 1477816, 954967]);
		expect(video.map((v) => `${v.width}x${v.height}`)).toEqual([
			"960x540",
			"1920x1080",
			"1280x720",
			"960x540",
			"768x432",
			"512x288",
		]);
		for (const v of video) {
			expect(v.codecs?.endsWith(",ec-3")).toBe(true);
		}
	});

	it("emits segment start times in milliseconds, cumulative from zero", () => {
		const top = manifest.video.get("avc1.640028-ec-3-11723161");
		expect(top).toBeDefined();
		const segments = top?.segments ?? [];
		expect(segments).toHaveLength(219);

		// #EXTINF is 6.006s -> durations and start times are milliseconds.
		expect(segments[0]?.startTime).toBe(0);
		expect(segments[0]?.duration).toBeCloseTo(6006, 0);

		// Regression guard: the running start time must NOT be re-converted
		// seconds->ms (which produced 6_006_000 for the second segment).
		expect(segments[1]?.startTime).toBeCloseTo(6006, 0);
		expect(segments[1]?.startTime ?? Number.POSITIVE_INFINITY).toBeLessThan(60_000);

		let expectedStart = 0;
		for (const segment of segments) {
			expect(segment.startTime).toBeCloseTo(expectedStart, 3);
			expectedStart += segment.duration;
		}

		expect(segments[0]?.initSegment).toBeDefined();
		expect(segments[0]?.initSegment?.url.href).toContain("init.mp4");
		expect(segments[0]?.isFirstInPeriod).toBe(true);
		expect(segments.at(-1)?.isLastInPeriod).toBe(true);
	});

	it("parses image (trickplay) tracks with tile layout", () => {
		const images = manifest.images.toArray();
		expect(images.map((i) => i.id)).toEqual(["35549", "24950", "12600"]);
		expect(images.map((i) => `${i.width}x${i.height}`)).toEqual(["416x234", "336x189", "224x126"]);
		for (const image of images) {
			expect("imageCols" in image && image.imageCols).toBe(6);
			expect("imageRows" in image && image.imageRows).toBe(5);
			expect(image.segments.length).toBeGreaterThan(0);
			expect(image.segments[0]?.startTime).toBe(0);
		}
	});

	it("maps closed-caption streams to languages", () => {
		expect(manifest.captionStreamToLanguage).toEqual({ cc1: "en", cc3: "es" });
	});

	it("parses SCTE-35 markers with presentation times in seconds", () => {
		const markers = manifest.scte35 ?? [];
		expect(markers).toHaveLength(22);

		const times = markers.map((m) => m.presentationTimeS);
		// Regression guard: presentation times are seconds, not milliseconds. The
		// asset runs ~22 minutes, so every marker must fall well under 2000s.
		expect(Math.max(...times)).toBeLessThan(2000);
		expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
		expect(times.some((t) => Math.abs(t - 87.68) < 0.01)).toBe(true);

		for (const marker of markers) {
			expect(marker.data).toBeDefined();
		}
	});

	it("parses subtitle renditions keyed by language with cumulative ms timing", () => {
		expect(manifest.text.toArray().map((t) => t.id)).toEqual(["text-en", "text-es"]);
		const english = manifest.text.get("text-en");
		const segments = english?.segments ?? [];
		expect(segments).toHaveLength(4);
		expect(segments[0]?.startTime).toBe(0);
		expect(segments[1]?.startTime).toBeCloseTo(segments[0]?.duration ?? 0, 3);
	});
});
