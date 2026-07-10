import { describe, expect, it } from "vitest";
import { getTestFile } from "../../../test/utils.js";
import { DashManifest } from "./dash.js";

describe("DashManifest", () => {
	it("should parse a DASH manifest", async () => {
		const manifestUrl = "http://example.com/manifest.mpd";
		const testManifest = await getTestFile("manifests/dash-multiperiod.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
	});
	it("should parse a DASH single period manifest", async () => {
		const manifestUrl = "http://example.com/manifest.mpd";
		const testManifest = await getTestFile("manifests/dash-single-period.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
	});
	it("should parse a Hulu VOD manifest with SegmentTemplate/SegmentTimeline", async () => {
		const manifestUrl = "https://example.com/hulu/manifest.mpd";
		const testManifest = await getTestFile("manifests/hulu-vod.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);

		expect(manifest.video.toArray().length).toBeGreaterThan(0);
		expect(manifest.audio.toArray().length).toBeGreaterThan(0);

		for (const representation of manifest.video.toArray()) {
			expect(representation.segments.length).toBeGreaterThan(0);
		}
		for (const representation of manifest.audio.toArray()) {
			expect(representation.segments.length).toBeGreaterThan(0);
		}

		expect(manifest.periods).toHaveLength(1);
		expect(manifest.periods[0]?.segmentsAvailable).toBeGreaterThan(0);
	});
	it("should parse a Discovery VOD manifest with SegmentBase representations", async () => {
		const manifestUrl = "https://example.com/discovery/manifest.mpd";
		const testManifest = await getTestFile("manifests/discovery-vod.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);

		expect(manifest.video.toArray().length).toBeGreaterThan(0);
		expect(manifest.audio.toArray().length).toBeGreaterThan(0);

		for (const representation of manifest.video.toArray()) {
			expect(representation.segments.length).toBeGreaterThan(0);
		}
		for (const representation of manifest.audio.toArray()) {
			expect(representation.segments.length).toBeGreaterThan(0);
		}

		expect(manifest.periods).toHaveLength(1);
		expect(manifest.periods[0]?.segmentsAvailable).toBeGreaterThan(0);
	});
	it("should parse an HBO/Max multi-period manifest and preserve explicit Period@start values", async () => {
		const manifestUrl = "https://example.com/hbo/manifest.mpd";
		const testManifest = await getTestFile("manifests/hbo.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);

		expect(manifest.video.toArray().length).toBeGreaterThan(0);
		expect(manifest.audio.toArray().length).toBeGreaterThan(0);

		// Every period declares an explicit `start`, so those values must be honored verbatim.
		const expectedStarts = [0, 30.03, 594.677, 1489.779, 1958.497, 2005.877];
		expect(manifest.periods).toHaveLength(expectedStarts.length);
		expectedStarts.forEach((expected, i) => {
			expect(manifest.periods[i]?.start).toBeCloseTo(expected, 3);
		});
	});
	it("should derive period start times from durations when Period@start is absent (Paramount)", async () => {
		const manifestUrl = "https://example.com/paramount/manifest.mpd";
		const testManifest = await getTestFile("manifests/paramount.mpd");
		const parser = new DashManifest();
		const { manifest } = await parser.parse(testManifest, manifestUrl);

		expect(manifest.video.toArray().length).toBeGreaterThan(0);
		expect(manifest.audio.toArray().length).toBeGreaterThan(0);

		expect(manifest.periods).toHaveLength(6);

		const starts = manifest.periods.map((p) => p.start);

		// Regression guard: periods declare only `duration` (no `start`), so the starts
		// must accumulate from preceding period durations rather than all collapsing to 0.
		expect(starts.every((start) => start === 0)).toBe(false);

		// Starts follow the running sum of the preceding periods' declared durations.
		const expectedStarts = [0, 30.03, 36.036, 226.226, 538.538, 1203.202];
		expectedStarts.forEach((expected, i) => {
			expect(manifest.periods[i]?.start).toBeCloseTo(expected, 3);
		});

		// Starts must be strictly increasing across the presentation timeline.
		for (let i = 1; i < starts.length; i++) {
			expect(starts[i]).toBeGreaterThan(starts[i - 1] as number);
		}
	});
	it("marks MPD@type=dynamic as live and static (default) as not live", async () => {
		const staticManifest = await getTestFile("manifests/dash-single-period.mpd");
		const { manifest: staticParsed } = await new DashManifest().parse(
			staticManifest,
			"http://example.com/manifest.mpd",
		);
		expect(staticParsed.isLive).toBe(false);

		const dynamicManifest = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic"',
			'  profiles="urn:mpeg:dash:profile:isoff-live:2011"',
			'  availabilityStartTime="2020-01-01T00:00:00Z" minimumUpdatePeriod="PT2S" minBufferTime="PT4S">',
			'  <Period id="0" start="PT0S">',
			'    <AdaptationSet mimeType="video/mp4" contentType="video">',
			'      <SegmentTemplate media="$Number$.m4s" initialization="init.m4s" duration="2" timescale="1" startNumber="1"/>',
			'      <Representation id="v0" bandwidth="1000000" codecs="avc1.4d401f" width="640" height="360"/>',
			"    </AdaptationSet>",
			"  </Period>",
			"</MPD>",
		].join("\n");
		const { manifest: dynamicParsed } = await new DashManifest().parse(dynamicManifest, "http://example.com/live.mpd");
		expect(dynamicParsed.isLive).toBe(true);
	});
	// describe("DASH-IF test vectors", async () => {
	// 	const dashTestVectors = await getTestFile("manifests/DASH IF Test Assets Database.csv");
	// 	await new Promise<void>((resolve, reject) => {
	// 		const stream = parse({ delimiter: ";", headers: true })
	// 			.on("error", (error) => reject(error))
	// 			.on("data", (row) => {
	// 				it(`should parse vector ${row["Testvector"]}`, async () => {
	// 					// Check to see if manifest is cached
	// 					let manifest: string;
	// 					const manifestURL = new URL(row["URL"]);
	// 					const manifestFileName = manifestURL.pathname.split("/").pop();

	// 					try {
	// 						manifest = await getTestFile(`manifests/dash-if-cache/${manifestFileName}`);
	// 					} catch (e) {
	// 						manifest = (await axios(row["URL"])).data;
	// 						await writeTestFile(`manifests/dash-if-cache/${manifestFileName}`, manifest);
	// 					}

	// 					const parser = new DashManifest();
	// 					const parsedManifest = await parser.parse(manifest, row["URL"]);
	// 					expect(parsedManifest).toBeDefined();
	// 				});
	// 			})
	// 			.on("end", (rowCount: number) => resolve());
	// 		stream.write(dashTestVectors);
	// 		stream.end();
	// 	});
	// });
});
