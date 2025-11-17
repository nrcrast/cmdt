import fs from "node:fs/promises";
import path from "node:path";
import { PromisePool } from "@supercharge/promise-pool";
import axios from "axios";
import cliProgress from "cli-progress";
import type { Manifest } from "cmdt-shared";
import { mkdirp } from "mkdirp";
import type winston from "winston";
import { getOpts } from "./cli-opts.js";
import { type DownloadEntry, DownloadQueue } from "./download-queue.js";
import { getInstance as getLogger } from "./logger.js";
import { canAccessFile } from "./utils/file.js";

export class SegmentDownloader {
	private queue?: DownloadQueue;
	private logger: winston.Logger;
	constructor(private manifest: Manifest) {
		this.logger = getLogger();
	}
	public async download(): Promise<DownloadQueue> {
		this.logger.info("Building download queue...");
		this.queue = this.buildManifestDownloadQueue();
		this.logger.info(`Download queue length: ${this.queue.getEntries().length}`);
		if (!getOpts().skipDownload) {
			await this.doDownload();
		} else {
			this.logger.warn("Skipping download");
		}
		return this.queue;
	}
	public getQueue(): DownloadQueue | undefined {
		return this.queue;
	}
	private async doDownload(): Promise<void> {
		this.logger.info("Downloading segments...");

		const showProgress = ["info", "debug"].includes(getOpts().logLevel);

		const downloadProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

		if (showProgress) {
			downloadProgressBar.start(this.queue?.getEntries().length ?? 0, 0);
		}

		await PromisePool.withConcurrency(5)
			.for(this.queue?.getEntries() ?? [])
			// biome-ignore lint/suspicious/noExplicitAny: error type
			.handleError(async (error: any, download: DownloadEntry) => {
				this.logger.error(`Error downloading segment: ${download.url}`, error);
			})
			.process(async (download: DownloadEntry) => {
				const dir = path.dirname(path.resolve(download.destDir, download.destFile));
				await mkdirp(dir);

				const exists = await canAccessFile(path.resolve(download.destDir, download.destFile));

				if (exists) {
					this.logger.warn(
						`File already exists: ${path.resolve(download.destDir, download.destFile)}. Skipping download.`,
					);
					if (showProgress) {
						downloadProgressBar.increment();
					}
					return;
				}

				const response = await axios.get(download.url, {
					responseType: "arraybuffer",
				});

				await fs.writeFile(path.resolve(download.destDir, download.destFile), response.data);

				if (showProgress) {
					downloadProgressBar.increment();
				}
			});

		downloadProgressBar.stop();
	}

	private buildManifestDownloadQueue(): DownloadQueue {
		const manifest = this.manifest;
		const queue = new DownloadQueue();
		const mediaTypes = [manifest.audio, manifest.images, manifest.video].map((r) => r.toArray());
		for (const mediaType of mediaTypes) {
			for (const representation of mediaType) {
				for (const segment of representation.segments) {
					queue.addSegment(segment, representation);
				}
			}
		}
		return queue;
	}
}
