import fs from "node:fs";
import { beforeEach, vi } from "vitest";
import { representationFactory } from "./factories/representation";
import { segmentFactory } from "./factories/segment";

vi.mock("fs");
vi.mock("fs/promises");
vi.mock("axios");

vi.mock("../src/cli-opts.js", () => {
	return {
		getOpts: vi.fn(() => ({
			manifest: "https://example.com/manifest.mpd",
			output: "./output",
			skipDownload: undefined,
			logLevel: "info" as const,
			dashConformance: undefined,
			thumbnails: undefined,
			mediaStreamValidator: undefined,
			logPeriods: undefined,
		})),
	};
});

vi.mock("../src/logger.js", () => {
	return {
		getInstance: () => ({
			info: vi.fn(),
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		}),
	};
});

beforeEach(() => {
	segmentFactory.rewindSequence();
	representationFactory.rewindSequence();
	vi.spyOn(fs.promises, "access").mockImplementation(async () => {
		return;
	});
});
