import { PromisePool } from "@supercharge/promise-pool";
import { type ILogObj, Logger } from "tslog";
import type { Manifest, Representation, Segment } from "../src/manifest.js";

export class SegmentDownloader {
	private logger: Logger<ILogObj>;
	private cancelled = false;
	constructor(private manifest: Manifest) {
		this.logger = new Logger<ILogObj>();
	}
	public cancel() {
		this.cancelled = true;
	}
	public async start(options: {
		batchSize: number;
		onSegmentAvailable: (segment: Segment, representation: Representation) => Promise<void>;
		onProgress: (nSegment: number, totalSegments: number) => void;
	}): Promise<void> {
		if (this.cancelled) {
			return;
		}
		const representations = [
			...this.manifest.audio.toArray(),
			...this.manifest.video.toArray(),
			...this.manifest.images.toArray(),
		];
		const nSegments = representations.reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0);
		this.logger.info(`Downloading ${nSegments} segments...`);
		let nSegmentProgress = 0;

		for (const representation of representations) {
			await PromisePool.withConcurrency(5)
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
					await segment.initSegment?.download();
					await segment.media?.download();
					options.onProgress(nSegmentProgress, nSegments);
					await options.onSegmentAvailable(segment, representation);
				});
		}
	}
}
