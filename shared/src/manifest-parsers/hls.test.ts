import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { getTestFile } from "../../test/utils.js";
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
