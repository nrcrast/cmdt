import type { Manifest } from "cmdt-shared";
import { fs } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBinaryTestFile, getTestFile } from "../test/utils.js";
import { GapChecker } from "./gap-checker.js";
import { DashManifest } from "./manifest-parsers/dash/dash.js";
import { Report } from "./report.js";
import type { ParsedBox } from "./utils/mp4/types.js";
import Mp4Parser from "./utils/mp4/parser.js";

const TEST_SEGMENT_TIMESCALE = 24000;
const TEST_SEGMENT_NUM_SAMPLES = 96;

function updateDecodeTime(data: Buffer, newTimeMs: number): Buffer {
	new Mp4Parser()
		.box("moof", Mp4Parser.children)
		.box("traf", Mp4Parser.children)
		.fullBox("tfdt", (box: ParsedBox) => {
			if (box.version === 1) {
				box.reader.setUint64(box.reader.getPosition(), (newTimeMs / 1000) * TEST_SEGMENT_TIMESCALE);
			} else {
				box.reader.setUint32(box.reader.getPosition(), (newTimeMs / 1000) * TEST_SEGMENT_TIMESCALE);
			}
		})
		.parse(data.buffer as ArrayBuffer);
	return data;
}

function updateDuration(data: Buffer, newDuration: number): Buffer {
	new Mp4Parser()
		.box("moof", Mp4Parser.children)
		.box("traf", Mp4Parser.children)
		.fullBox("trun", (box: ParsedBox) => {
			const initialPosition = box.reader.getPosition();
			const trunBox = Mp4Parser.parseTrun(box);
			const entrySizeBytes = 12;
			const baseBoxSize = box.size - entrySizeBytes * trunBox.sampleCount;
			const newSize = baseBoxSize + entrySizeBytes * TEST_SEGMENT_NUM_SAMPLES;
			const sampleDuration = Math.floor((newDuration / 1000 / TEST_SEGMENT_NUM_SAMPLES) * TEST_SEGMENT_TIMESCALE);
			Mp4Parser.updateBoxSize(box.reader, box.start, newSize);

			box.reader.setPosition(initialPosition);
			box.reader.setUint32(box.reader.getPosition(), TEST_SEGMENT_NUM_SAMPLES);
			box.reader.skip(8); // Skip "data_offset" and "first_sample_flags"

			// Skip "first_sample_flags" if present
			if (box.flags & 0x000004) {
				box.reader.skip(4);
			}

			for (let i = 0; i < TEST_SEGMENT_NUM_SAMPLES; i += 1) {
				box.reader.setUint32(box.reader.getPosition(), sampleDuration);
				box.reader.skip(4);
				box.reader.setUint32(box.reader.getPosition(), 0);
				box.reader.skip(4);
				box.reader.setUint32(box.reader.getPosition(), 0);
				box.reader.skip(4);
			}
			box.reader.setPosition(initialPosition);
		})
		.parse(data.buffer as ArrayBuffer);
	return data;
}

describe("GapChecker", () => {
	let fakeInitSegment: Buffer;
	let fakeSegment: Buffer;
	let checker: GapChecker;
	let report: Report;
	let manifest: Manifest;
	beforeEach(async () => {
		fakeInitSegment = await getBinaryTestFile("segments/seg.mp4");
		fakeSegment = await getBinaryTestFile("segments/seg_0.mp4");
		const manifestUrl = "http://example.com/manifest.mpd";
		const testManifest = await getTestFile("manifests/gaps.mpd");
		manifest = await new DashManifest().parse(testManifest, manifestUrl);
		checker = new GapChecker(manifest);
		report = new Report();

		// Fake segment file paths
		for (const representation of [...manifest.audio.toArray(), ...manifest.video.toArray()]) {
			for (const segment of representation.segments) {
				segment.fileSystemPath = JSON.stringify({
					type: "segment",
					time: segment.rawSegmentTime,
					duration: segment.duration,
				});
				segment.initSegmentFilesystemPath = JSON.stringify({ type: "init" });
			}
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("should detect a single gap", async () => {
		// @ts-expect-error
		vi.spyOn(fs.promises, "readFile").mockImplementation(async (info: string) => {
			const data = JSON.parse(info);
			if (data.type === "segment") {
				const segment = updateDecodeTime(fakeSegment, data.time);
				return updateDuration(segment, data.duration);
			} else if (data.type === "init") {
				return fakeInitSegment;
			}
		});

		vi.spyOn(report, "addGap");
		vi.spyOn(report, "addDurationMismatch");
		vi.spyOn(report, "addDecodeTimeMismatch");
		await checker.analyzeGaps(report);
		expect(report.addDecodeTimeMismatch).toHaveBeenCalledTimes(0);
		expect(report.addDurationMismatch).toHaveBeenCalledTimes(0);
		expect(report.addGap).toHaveBeenCalledTimes(manifest.video.size);
	});

	it("should detect decode time mismatch", async () => {
		// @ts-expect-error
		vi.spyOn(fs.promises, "readFile").mockImplementation(async (info: string) => {
			const data = JSON.parse(info);
			if (data.type === "segment") {
				return updateDecodeTime(fakeSegment, data.time + 50);
			} else if (data.type === "init") {
				return fakeInitSegment;
			}
		});

		vi.spyOn(report, "addDecodeTimeMismatch");
		await checker.analyzeGaps(report);
		expect(report.addDecodeTimeMismatch).toHaveBeenCalledTimes(1953);
	});

	it("should detect segment duration mismatch", async () => {
		// @ts-expect-error
		vi.spyOn(fs.promises, "readFile").mockImplementation(async (info: string) => {
			const data = JSON.parse(info);
			if (data.type === "segment") {
				const segment = updateDecodeTime(fakeSegment, data.time);
				return updateDuration(segment, data.duration + 50); // Add 50ms
			} else if (data.type === "init") {
				return fakeInitSegment;
			}
		});

		vi.spyOn(report, "addDurationMismatch");
		await checker.analyzeGaps(report);
		expect(report.addDurationMismatch).toHaveBeenCalledTimes(1953);
	});
});
