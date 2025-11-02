import fs from "node:fs/promises";
import path from "node:path";
import { PromisePool } from "@supercharge/promise-pool";
import axios from "axios";
import cliProgress from "cli-progress";
import type { Cue, Manifest, Representation, Segment } from "cmdt-shared";
import { mkdirp } from "mkdirp";
import type winston from "winston";
import { getOpts } from "./cli-opts.js";
import { getInstance as getLogger } from "./logger.js";

export type DownloadEntry = {
	url: string;
	destDir: string;
	destFile: string;
	segment?: Segment;
	captions?: Array<Cue>;
	representation: Representation;
};

export class SegmentDownloader {
	private queue: Array<DownloadEntry> = [];
	private logger: winston.Logger;
	constructor(private manifest: Manifest) {
		this.logger = getLogger();
	}
	public async download(): Promise<Array<DownloadEntry>> {
		this.logger.info("Building download queue...");
		this.queue = this.buildManifestDownloadQueue();
		this.logger.info(`Download queue length: ${this.queue.length}`);
		if (!getOpts().skipDownload) {
			await this.doDownload(this.queue);
		} else {
			this.logger.warn("Skipping download");
		}
		return this.queue;
	}
	public getQueue(): Array<DownloadEntry> {
		return this.queue;
	}
	private async doDownload(queue: Array<DownloadEntry>): Promise<void> {
		this.logger.info("Downloading segments...");

		const showProgress = ["info", "debug"].includes(getOpts().logLevel);

		const downloadProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

		if (showProgress) {
			downloadProgressBar.start(queue.length, 0);
		}

		await PromisePool.withConcurrency(5)
			.for(queue)
			// biome-ignore lint/suspicious/noExplicitAny: error type
			.handleError(async (error: any, download: DownloadEntry) => {
				this.logger.error(`Error downloading segment: ${download.url}`, error);
			})
			.process(async (download: DownloadEntry) => {
				const dir = path.dirname(path.resolve(download.destDir, download.destFile));
				await mkdirp(dir);

				const exists = await fs
					.access(path.resolve(download.destDir, download.destFile), fs.constants.R_OK | fs.constants.W_OK)
					.then(() => true)
					.catch(() => false);

				if (exists) {
					this.logger.warn(`File already exists: ${path.resolve(download.destDir, download.destFile)}. Skipping download.`);
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

	private resolveUrl(manifest: Manifest, url: string): string {
		if (!url.startsWith("http")) {
			if (url.startsWith("/")) {
				return `${manifest.url.origin}${url}`;
			}
			return `${manifest.url.origin}/${url}`;
		}
		return url;
	}

	private buildManifestDownloadQueue(): Array<DownloadEntry> {
		const manifest = this.manifest;
		const dlDirBase = getOpts().output;
		const downloads: Array<DownloadEntry> = [];
		const mediaTypes = [manifest.audio, manifest.images, manifest.video].map((r) => r.toArray());
		const initSegments = new Map<string, string>();
		for (const mediaType of mediaTypes) {
			for (const representation of mediaType) {			
				for (const segment of representation.segments) {
					let uriPath = new URL(segment.url).pathname;
					if(uriPath.startsWith('/')) {
						uriPath = uriPath.substring(1);
					}
					let destDir = path.resolve(dlDirBase, uriPath.split("/").slice(0, -1).join("/"));
					const destFile = uriPath.split("/").pop() ?? "";
					if (segment.initSegmentUrl && !initSegments.has(segment.initSegmentUrl)) {
						let initSegmentUriPath = new URL(segment.initSegmentUrl).pathname;
						if(initSegmentUriPath.startsWith('/')) {
							initSegmentUriPath = initSegmentUriPath.substring(1);
						}
						destDir = path.resolve(dlDirBase, initSegmentUriPath.split("/").slice(0, -1).join("/"));
						const initSegmentFile = initSegmentUriPath.split("/").pop() ?? "";
						initSegments.set(segment.initSegmentUrl, path.resolve(destDir, initSegmentFile));
						downloads.push({
							url: this.resolveUrl(manifest, segment.initSegmentUrl),
							destDir,
							destFile: initSegmentFile,
							representation,
						});
					}
					downloads.push({
						url: this.resolveUrl(manifest, segment.url),
						destDir,
						destFile,
						representation,
						segment,
					});
					segment.fileSystemPath = path.resolve(destDir, destFile);
					if (segment.initSegmentUrl) {
						segment.initSegmentFilesystemPath = initSegments.get(segment.initSegmentUrl);
					}
				}
			}
		}
		return downloads;
	}
}
