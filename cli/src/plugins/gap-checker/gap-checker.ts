import fs from "node:fs/promises";
import cliProgress from "cli-progress";
import type { Manifest, Representation, Segment } from "cmdt-shared";
import type winston from "winston";
import { getOpts } from "../../cli-opts.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { canAccessFile } from "../../utils/file.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { Mdhd, ParsedBox, Tfdt, Tfhd, Tkhd } from "../../utils/mp4/types.js";
import { secondsToMilliseconds } from "../../utils/time-utils.js";

const GAP_TOLERANCE_MS = 100;

export class GapChecker {
	private logger: winston.Logger;
	constructor(private manifest: Manifest) {
		this.logger = getLogger();
	}

	private isGap(timeA: number, timeB: number) {
		return timeB - timeA > GAP_TOLERANCE_MS;
	}

	private getTimescaleForTracks(initSegment: Buffer): Map<number, number> {
		const trackIds: Array<number> = [];
		const timescales: Array<number> = [];
		const trackIdToTimescale = new Map<number, number>();
		new Mp4Parser()
			.box("moov", Mp4Parser.children)
			.box("mvex", Mp4Parser.children)
			.box("trak", Mp4Parser.children)
			.fullBox("tkhd", (box: ParsedBox) => {
				const parsedTkhdBox: Tkhd = Mp4Parser.parseTkhd(box);
				trackIds.push(parsedTkhdBox.trackId);
			})
			.box("mdia", Mp4Parser.children)
			.fullBox("mdhd", (box: ParsedBox) => {
				const parsedMdhdBox: Mdhd = Mp4Parser.parseMdhd(box);
				timescales.push(parsedMdhdBox.timescale);
			})
			.box("minf", Mp4Parser.children)
			.box("stbl", Mp4Parser.children)
			.fullBox("stsd", Mp4Parser.sampleDescription)
			.parse(new Uint8Array(initSegment).buffer);
		trackIds.forEach((trackId: number, idx: number) => {
			if (!timescales[idx]) {
				this.logger.error(`No timescale for track ${trackId} at index ${idx}`);
				return;
			}
			trackIdToTimescale.set(trackId, timescales[idx]);
		});
		return trackIdToTimescale;
	}

	private async getSegmentInfo(segment: Segment): Promise<{ decodeTime: number; duration: number }> {
		if (!segment.fileSystemPath || !segment.initSegmentFilesystemPath) {
			throw new Error("Segment does not have a file system path");
		}
		const [initSegmentAccessible, segmentAccessible] = await Promise.all([
			canAccessFile(segment.initSegmentFilesystemPath),
			canAccessFile(segment.fileSystemPath),
		]);
		if (!initSegmentAccessible || !segmentAccessible) {
			this.logger.error(
				`Files do not exist for segment ${segment.url}. Expected ${segment.fileSystemPath} and ${segment.initSegmentFilesystemPath}`,
			);
			return { decodeTime: 0, duration: 0 };
		}
		const initSegment = await fs.readFile(segment.initSegmentFilesystemPath);
		const segmentData = await fs.readFile(segment.fileSystemPath);

		const timescalesPerTrack = this.getTimescaleForTracks(initSegment);

		let timescale = 1000; // Default
		let baseMediaDecodeTime = 0;
		let duration = 0;

		new Mp4Parser()
			.box("moof", Mp4Parser.children)
			.box("traf", Mp4Parser.children)
			.fullBox("tfhd", (box: ParsedBox) => {
				const parsedTfhdBox: Tfhd = Mp4Parser.parseTfhd(box);
				const trackTimescale: number | undefined = timescalesPerTrack.get(parsedTfhdBox.trackId);
				if (trackTimescale !== undefined) {
					timescale = trackTimescale;
				}
			})
			.fullBox("trun", (box: ParsedBox) => {
				const parsedTrunBox = Mp4Parser.parseTrun(box);
				duration = parsedTrunBox.sampleData.reduce((acc: number, sample) => {
					acc += sample.sampleDuration ?? 0;
					return acc;
				}, 0);
			})
			.fullBox("tfdt", (box: ParsedBox) => {
				const parsedTfdtBox: Tfdt = Mp4Parser.parseTfdt(box);
				baseMediaDecodeTime = parsedTfdtBox.baseMediaDecodeTime;
			})
			.parse(new Uint8Array(segmentData).buffer);
		return {
			decodeTime: secondsToMilliseconds(baseMediaDecodeTime / timescale),
			duration: secondsToMilliseconds(duration / timescale),
		};
	}

	private getTotalMediaSegments(representations: Representation[]): number {
		const totalNumSegments = representations.reduce((acc: number, representation) => {
			acc += representation.segments.length;
			return acc;
		}, 0);
		return totalNumSegments;
	}

	public async analyzeGaps(report: Report) {
		const representations = [...this.manifest.audio.toArray(), ...this.manifest.video.toArray()].filter(
			(r) => r.segments.length > 0,
		);

		const totalNumSegments = this.getTotalMediaSegments(representations);

		this.logger.info(`Checking for gaps in ${totalNumSegments} segments...`);

		const showProgress = ["info", "debug"].includes(getOpts().logLevel);
		const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		if (showProgress) {
			progress.start(totalNumSegments, 0);
		}

		for (const representation of representations) {
			// All segments in stream should be contiguous
			for (let i = 1; i < representation.segments.length; i += 1) {
				if (showProgress) {
					progress.increment();
				}
				const currentSegment = representation.segments[i];
				const previousSegment = representation.segments[i - 1];
				if (!currentSegment) {
					this.logger.error(`No current segment for ${representation.id} at index ${i}`);
					continue;
				} else if (!previousSegment) {
					this.logger.error(`No previous segment for ${representation.id} at index ${i}`);
					continue;
				}
				await this.checkSegment(currentSegment, previousSegment, report, representation);
			}
		}

		progress.stop();
	}

	private async checkSegment(
		segment: Segment,
		previousSegment: Segment,
		report: Report,
		representation: Representation,
	) {
		const segmentInfo = await this.getSegmentInfo(segment);
		segment.baseMediaDecodeTime = segmentInfo.decodeTime;
		segment.mediaDuration = segmentInfo.duration;
		const expectedStart = previousSegment.startTime + previousSegment.duration;
		if (segment.rawSegmentTime !== undefined && Math.abs(segment.rawSegmentTime - segment.baseMediaDecodeTime) > 10) {
			report.addDecodeTimeMismatch(segment);
			this.logger.warn(
				`Expected start time ${segment.rawSegmentTime} does not match decode time ${segment.baseMediaDecodeTime}`,
			);
		}
		if (segment.duration && segment.mediaDuration && Math.abs(segment.duration - segment.mediaDuration) > 10) {
			report.addDurationMismatch(segment);
			this.logger.warn(`Expected duration ${segment.duration} does not match media duration ${segment.mediaDuration}`);
		}
		if (this.isGap(expectedStart, segment.startTime)) {
			report.addGap(representation, expectedStart, previousSegment, segment);
			this.logger.warn(`Gap detected in representation ${representation.id}`);
			this.logger.warn(JSON.stringify(previousSegment, null, 2));
			this.logger.warn(JSON.stringify(segment, null, 2));
		}
	}
}
