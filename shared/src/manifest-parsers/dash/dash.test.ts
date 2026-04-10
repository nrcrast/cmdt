import { describe, expect, it } from "vitest";
import { getTestFile } from "../../../test/utils.js";
import { DashManifest } from "./dash.js";

describe("DashManifest", () => {
	it("should parse a DASH manifest", async () => {
		const manifestUrl = "http://example.com/manifest.mpd";
		const testManifest = await getTestFile("manifests/dash-multiperiod.mpd");
		const parser = new DashManifest();
		const manifest = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
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
