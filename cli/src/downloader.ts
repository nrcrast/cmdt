import fs from "node:fs/promises";
import path from "node:path";
import { PromisePool } from "@supercharge/promise-pool";
import cliProgress from "cli-progress";
import { DownloadableChunk, Representation, Segment, type Manifest } from "cmdt-shared";
import type winston from "winston";
import { getOpts } from "./cli-opts.js";
import { type DownloadEntry, DownloadQueue } from "./download-queue.js";
import { getInstance as getLogger } from "./logger.js";
import { canAccessFile } from "./utils/file.js";
import { mkdirp } from "mkdirp";
import axios from "axios";
import { getUrlFilePath } from "./utils/url.js";

export class FilesystemDownloadableChunk extends DownloadableChunk {
	public destPath: string;
	public destFile: string;
	constructor(url: URL) {
		super(url);
		let uriPath = url.pathname;
		if (uriPath.startsWith("/")) {
			uriPath = uriPath.substring(1);
		}
		const dlDirBase = path.resolve(getOpts().output, "segments");
		this.destPath = path.resolve(dlDirBase, getUrlFilePath(url));
		this.destFile = uriPath.split("/").pop() ?? "";
	}
	public async download(): Promise<void> {
		const destPath = path.resolve(this.destPath, this.destFile);
		const dir = path.dirname(destPath);
		await mkdirp(dir);
		const exists = await canAccessFile(destPath);
		if (exists) {
			getLogger().debug(`File already exists: ${destPath}. Skipping download.`);
			return;
		}
		const response = await axios.get(this.url.href, {
			responseType: "arraybuffer",
		});

		await fs.writeFile(destPath, response.data);
	}
	public async getData(): Promise<ArrayBuffer> {
		await this.download();
		return (await fs.readFile(path.resolve(this.destPath, this.destFile))).buffer.slice(0);
	}
}

export class SegmentDownloader {
	private logger: winston.Logger;
	constructor(private manifest: Manifest) {
		this.logger = getLogger();
	}
	public async start(options: {
		batchSize: number;
		onSegmentAvailable: (segment: Segment, representation: Representation) => Promise<void>;
	}): Promise<void> {
		const representations = [...this.manifest.audio.toArray(), ...this.manifest.video.toArray(), ...this.manifest.images.toArray()];
		const nSegments = representations.reduce((acc, representation) => {
			return acc + representation.segments.length;
		}, 0);
		this.logger.info(`Downloading ${nSegments} segments...`);
		const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		progress.start(nSegments, 0);

		for (const representation of representations) {
					await PromisePool.withConcurrency(5)
			.for(representation.segments)
			// biome-ignore lint/suspicious/noExplicitAny: error type
			.handleError(async (error: any, segment: Segment) => {
				this.logger.error(`Error downloading segment: ${segment}`, error);
			})
			.process(async (segment: Segment) => {
				progress.increment();
				await segment.initSegment?.download();
				await segment.media?.download();
				await options.onSegmentAvailable(segment, representation);
			});
		}
		progress.stop();
	}
}
