import { describe, expect, it } from "vitest";
import { DownloadMode, DownloadModeInfo } from "../src/downloader.js";

describe("DownloadModeInfo", () => {
	it("has an entry for every DownloadMode value", () => {
		for (const mode of Object.values(DownloadMode)) {
			expect(DownloadModeInfo[mode]).toBeDefined();
		}
	});

	it("populates label, short and long as non-empty strings for every mode", () => {
		for (const mode of Object.values(DownloadMode)) {
			const info = DownloadModeInfo[mode];
			expect(info.label).toBeTypeOf("string");
			expect(info.label.length).toBeGreaterThan(0);
			expect(info.short).toBeTypeOf("string");
			expect(info.short.length).toBeGreaterThan(0);
			expect(info.long).toBeTypeOf("string");
			expect(info.long.length).toBeGreaterThan(0);
		}
	});

	it("populates degradedPlugins as an array for every mode", () => {
		for (const mode of Object.values(DownloadMode)) {
			expect(Array.isArray(DownloadModeInfo[mode].degradedPlugins)).toBe(true);
		}
	});
});
