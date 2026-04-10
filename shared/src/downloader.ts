import { PromisePool } from "@supercharge/promise-pool";
import { Representation, Segment, type Manifest } from "../src/manifest.js";
import { Logger, ILogObj } from "tslog";

export class SegmentDownloader {
	private logger: Logger<ILogObj>;
	constructor(private manifest: Manifest) {
		this.logger = new Logger<ILogObj>();
	}
	public async start(options: {
		batchSize: number;
		onSegmentAvailable: (segment: Segment, representation: Representation) => Promise<void>;
		onProgress: (nSegment: number, totalSegments: number) => void;
	}): Promise<void> {
		const representations = [...this.manifest.audio.toArray(), ...this.manifest.video.toArray(), ...this.manifest.images.toArray()];
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
			.process(async (segment: Segment) => {
				nSegmentProgress++;
				await segment.initSegment?.download();
				await segment.media?.download();
				options.onProgress(nSegmentProgress, nSegments);
				await options.onSegmentAvailable(segment, representation);
			});
		}
	}
}
