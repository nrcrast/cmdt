import { PromisePool } from "@supercharge/promise-pool";
import { type Manifest, MediaType, type Representation, type Segment } from "../src/manifest.js";
import { fixedPointInRange } from "./utils/float-utils.js";
import { getLogger } from "./utils/logger.js";
import { type AbsoluteTimeRange, getLiveEdgeMs } from "./utils/time-range.js";

export enum DownloadMode {
	ManifestOnly = "manifest-only",
	Quick = "quick",
	Full = "full",
}

export type ModeInfo = {
	label: string;
	short: string;
	long: string;
	degradedPlugins: string[];
};

// Display metadata for each DownloadMode. Consumed by the CLI for --help output
// and by the viewer for its mode selector and live description block.
// `degradedPlugins` lists the display names of built-in plugins whose output is
// empty or incomplete under that mode; hand-maintained alongside the plugin set.
export const DownloadModeInfo: Record<DownloadMode, ModeInfo> = {
	[DownloadMode.ManifestOnly]: {
		label: "Manifest only",
		short: "Parse the manifest; skip all segment downloads.",
		long: "Parses the manifest only. No segment bytes are fetched, so segment-derived analysis is skipped entirely. Fastest mode; useful for inspecting manifest structure such as periods, representations, and codecs.",
		degradedPlugins: ["CaptionExtractor", "EmsgExtractor", "GapChecker", "PsshExtractor", "WebVttParser"],
	},
	[DownloadMode.Quick]: {
		label: "Quick",
		short: "Download init segments fully and only the head of each media segment.",
		long: "Init segments are downloaded in full; media segments are downloaded partially (range-requested head bytes). Enough to read most MP4 box headers without pulling full media. Good for inspecting structure and signalling on large live streams.",
		degradedPlugins: ["CaptionExtractor"],
	},
	[DownloadMode.Full]: {
		label: "Full",
		short: "Download every byte of every segment.",
		long: "Downloads init segments and media segments in full. Required for complete caption extraction (CEA-608/708), full WebVTT cue parsing, and filesystem export. Slowest, most thorough mode.",
		degradedPlugins: [],
	},
};

const LARGE_SEGMENT_TYPES = new Set([MediaType.Video, MediaType.Audio]);

/** Default number of segments downloaded in parallel when `concurrency` is unset. */
export const DEFAULT_CONCURRENCY = 100;

export type DownloadOptions = {
	downloadMode: DownloadMode;
	downloadTimeRange?: AbsoluteTimeRange;
	numRetries?: number;
	concurrency?: number;
	onSegmentAvailable: (segment: Segment, representation: Representation) => Promise<void>;
	onProgress: (nSegment: number, totalSegments: number) => void;
};

export class SegmentDownloader {
	private logger = getLogger();
	private cancelled = false;
	constructor(private manifest: Manifest) {}
	public cancel() {
		this.cancelled = true;
	}
	private isSegmentInRange(range: DownloadOptions["downloadTimeRange"], streamEnd: number, segment: Segment): boolean {
		if (!range) {
			return true;
		}

		return (
			fixedPointInRange(segment.startTime, range.start, range.end ?? streamEnd, 2, {
				inclusiveEnd: false,
				inclusiveStart: true,
			}) &&
			fixedPointInRange(segment.startTime + segment.duration, range.start, range.end ?? streamEnd, 2, {
				inclusiveEnd: true,
				inclusiveStart: false,
			})
		);
	}
	public async start(options: DownloadOptions): Promise<void> {
		if (this.cancelled || options.downloadMode === DownloadMode.ManifestOnly) {
			return;
		}
		const representations = [
			...this.manifest.audio.toArray(),
			...this.manifest.video.toArray(),
			...this.manifest.images.toArray(),
			...this.manifest.text.toArray(),
		];

		// When a range leaves its end open, segments are kept up to the live edge.
		const maxEndTime = getLiveEdgeMs(this.manifest);

		const nSegments = representations.reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0);
		this.logger.info(`Downloading ${nSegments} segments...`);
		let nSegmentProgress = 0;

		for (const representation of representations) {
			await PromisePool.withConcurrency(options.concurrency ?? DEFAULT_CONCURRENCY)
				.for(representation.segments)
				// biome-ignore lint/suspicious/noExplicitAny: error type
				.handleError(async (error: any, segment: Segment) => {
					this.logger.error(`Error downloading segment: ${segment}`, error);
				})
				.process(async (segment: Segment, _index, pool) => {
					if (this.cancelled) {
						this.logger.info("Download cancelled");
						return pool.stop();
					}
					nSegmentProgress++;
					if (!this.isSegmentInRange(options.downloadTimeRange, maxEndTime, segment)) {
						this.logger.debug(`Segment at ${segment.startTime} not in range. Skipping`);
						return;
					}
					await segment.initSegment?.download({ numRetries: options.numRetries });
					await segment.media?.download({
						numRetries: options.numRetries,
						partial: LARGE_SEGMENT_TYPES.has(representation.type) && options.downloadMode === DownloadMode.Quick,
					});
					options.onProgress(nSegmentProgress, nSegments);
					await options.onSegmentAvailable(segment, representation);
				});
		}
	}
}
