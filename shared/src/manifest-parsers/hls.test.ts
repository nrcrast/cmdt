import { describe, expect, it, vi } from "vitest";
import { getTestFile } from "../../test/utils.js";
import { HlsManifest } from "./hls.js";
import axios from "axios";

vi.mock("axios");

describe("HlsManifest", () => {
	it("should parse an HLS manifest", async () => {
        vi.mocked(axios.get).mockImplementation(async (url: string) => {
			return {
				data: await getTestFile(`manifests/hls/${new URL(url).pathname.split("/").pop()}`),
			};
		});
		const manifestUrl = "http://example.com/manifest.mpd";
		const testManifest = await getTestFile("manifests/hls/master.m3u8");
		const parser = new HlsManifest();
		const manifest = await parser.parse(testManifest, manifestUrl);
		expect(manifest).toMatchSnapshot();
	});
});
