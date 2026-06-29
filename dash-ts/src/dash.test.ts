import { parse } from "@fast-csv/parse";
import axios from "axios";
import { describe, expect, it } from "vitest";
import { getTestFile, writeTestFile } from "../test-utils/utils.js";
import { getRawDashManifest } from "./dash.js";

describe("RawDashManifest", () => {
	it("should parse a DASH manifest", async () => {
		const testManifest = await getTestFile("manifests/dash-multiperiod.mpd");
		const manifest = await getRawDashManifest(testManifest);
		expect(manifest).toMatchSnapshot();
	});
	it("should parse a single-period dynamic manifest with ProducerReferenceTime", async () => {
		const testManifest = await getTestFile("manifests/2min-single-period-with-prft.mpd");
		const manifest = await getRawDashManifest(testManifest);
		expect(manifest).toMatchSnapshot();
		expect(manifest.type).toBe("dynamic");
		expect(manifest.periods).toHaveLength(1);
		const prft = manifest.periods[0]?.adaptationSet?.[0]?.producerReferenceTime?.[0];
		expect(prft).toBeDefined();
		expect(prft?.wallClockTime).toBe("2026-06-26T21:11:55.139Z");
		expect(prft?.utcTiming?.[0]?.schemeIdUri).toBe("urn:mpeg:dash:utc:http-iso:2014");
	});
	it("should parse capitalized SCTE-35 <Signal>/<Binary> events", async () => {
		const binary = "/DA6AAAAAAAAAP/wBQb+AHhl1gAkAiJDVUVJAAAAAX//AAAAAAAODkdUTVYwMDAwMTA1MTkzIgEBdihHBw==";
		const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:scte35="urn:scte:scte35:2014:xml+bin" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="static" minBufferTime="PT5S" mediaPresentationDuration="PT1M">
  <Period duration="PT1M">
    <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin" value="scte35" timescale="90000">
      <Event id="1" presentationTime="7890390" duration="0">
        <scte35:Signal>
          <scte35:Binary>${binary}</scte35:Binary>
        </scte35:Signal>
      </Event>
    </EventStream>
  </Period>
</MPD>`;
		const manifest = await getRawDashManifest(manifestXml);
		const event = manifest.periods[0]?.eventStream?.[0]?.event?.[0];
		expect(event?.["scte35:signal"]?.["scte35:binary"]).toBe(binary);
	});
	describe("DASH-IF test vectors", async () => {
		const dashTestVectors = await getTestFile("manifests/DASH IF Test Assets Database.csv");
		await new Promise<void>((resolve, reject) => {
			const stream = parse({ delimiter: ";", headers: true })
				.on("error", (error) => reject(error))
				.on("data", (row) => {
					it(`should parse vector ${row.Testvector}`, async () => {
						// Check to see if manifest is cached
						let manifest: string;
						const manifestURL = new URL(row.URL);
						const manifestFileName = manifestURL.pathname.split("/").pop();

						if (!manifestFileName?.endsWith("mpd")) {
							return;
						}

						try {
							manifest = await getTestFile(`manifests/dash-if-cache/${manifestFileName}`);
							// biome-ignore lint/correctness/noUnusedVariables: Specific error unimportant
						} catch (e) {
							manifest = (await axios(row.URL)).data;
							await writeTestFile(`manifests/dash-if-cache/${manifestFileName}`, manifest);
						}

						const parsedManifest = await getRawDashManifest(manifest);
						expect(parsedManifest).toBeDefined();
					});
				})
				.on("end", () => resolve());
			stream.write(dashTestVectors);
			stream.end();
		});
	});
});
