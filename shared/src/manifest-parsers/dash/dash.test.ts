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
