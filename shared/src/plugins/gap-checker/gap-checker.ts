import { MediaType, type Manifest, type Representation, type Segment } from "../../manifest.js";
import type { Report } from "../../report.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { Mdhd, ParsedBox, Tfdt, Tfhd, Tkhd } from "../../utils/mp4/types.js";
import { secondsToMilliseconds } from "../../utils/time-utils.js";
import { Plugin, PluginArtifact } from "../plugin.js";

const GAP_TOLERANCE_MS = 100;

type ParsedSegmentInfo = {
	decodeTime: number;
	duration: number;
};
export class GapChecker extends Plugin {
	private segmentInfo: Map<Segment, ParsedSegmentInfo>;
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "gap-checker");
		this.segmentInfo = new Map();
	}

	private isGap(timeA: number, timeB: number) {
		return timeB - timeA > GAP_TOLERANCE_MS;
	}

	private getTimescaleForTracks(initSegment: ArrayBuffer): Map<number, number> {
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

	public override async processSegment(segment: Segment, representation: Representation): Promise<void> {
		if (![MediaType.Audio, MediaType.Video].includes(representation.type)) {
			return;
		}
		const info = await this.getSegmentInfo(segment);
		this.segmentInfo.set(segment, info);
	}

	private async getSegmentInfo(segment: Segment): Promise<ParsedSegmentInfo> {
		const [initSegmentData, segmentData] = await Promise.all([
			segment.initSegment?.getData(),
			segment.media?.getData(),
		]);
		if (!initSegmentData || !segmentData) {
			this.logger.error(`Failed to get segment info for ${segment.url}`);
			return { decodeTime: 0, duration: 0 };
		}

		const timescalesPerTrack = this.getTimescaleForTracks(initSegmentData);

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

	public override async finalize(): Promise<PluginArtifact[]> {
		const representations = [...this.manifest.audio.toArray(), ...this.manifest.video.toArray()].filter(
			(r) => r.segments.length > 0,
		);

		for (const representation of representations) {
			// All segments in stream should be contiguous
			for (let i = 1; i < representation.segments.length; i += 1) {
				const currentSegment = representation.segments[i];
				const previousSegment = representation.segments[i - 1];
				if (!currentSegment) {
					this.logger.error(`No current segment for ${representation.id} at index ${i}`);
					continue;
				} else if (!previousSegment) {
					this.logger.error(`No previous segment for ${representation.id} at index ${i}`);
					continue;
				}
				await this.checkSegment(currentSegment, previousSegment, this.report, representation);
			}
		}

		return [];
	}

	private async checkSegment(
		segment: Segment,
		previousSegment: Segment,
		report: Report,
		representation: Representation,
	) {
		const segmentInfo = this.segmentInfo.get(segment);
		if (!segmentInfo) {
			this.logger.warn(`No segment info for ${segment}`);
			return;
		}
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
		// TODO -- be smarter about this. Check for compatible segments across periods
		if (!previousSegment.isLastInPeriod && !segment.isFirstInPeriod && this.isGap(expectedStart, segment.startTime)) {
			report.addGap(representation, expectedStart, previousSegment, segment);
			this.logger.warn(
				`Gap detected in representation ${representation.id}. Expected start: ${expectedStart} Start: ${segment.startTime}`,
			);
			this.logger.warn(JSON.stringify(previousSegment, null, 2));
			this.logger.warn(JSON.stringify(segment, null, 2));
		}
	}
}
