import fs from "node:fs/promises";
import path from "node:path";
import { PromisePool } from "@supercharge/promise-pool";
import cliProgress from "cli-progress";
import { type ImageRepresentation, MediaType } from "cmdt-shared";
import { Jimp } from "jimp";
import type winston from "winston";
import { getOpts } from "../../cli-opts.js";
import type { DownloadEntry } from "../../downloader.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";

type ThumbnailBuffer = { buffer: Buffer; filePath: string; hash: string };

export class ThumbnailExtractor {
	private logger: winston.Logger;
	constructor() {
		this.logger = getLogger();
	}
	public async extractFromDownloadedSegments(downloads: Array<DownloadEntry>, report: Report): Promise<void> {
		if (!getOpts().thumbnails) {
			this.logger.warn("Skipping thumbnail extraction");
			return;
		}
		this.logger.info("Processing thumbnails...");
		const showProgress = ["info", "debug"].includes(getOpts().logLevel);
		const thumbnailProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		const imageDownloads = downloads.filter((d) => d.representation.type === MediaType.Image);
		if (showProgress) {
			thumbnailProgressBar.start(imageDownloads.length, 0);
		}

		await PromisePool.withConcurrency(5)
			.for(imageDownloads)
			// biome-ignore lint/suspicious/noExplicitAny: error type
			.handleError(async (error: any, download: DownloadEntry) => {
				this.logger.warn(`Error processing image: ${download.url}`, error);
			})
			.process(async (download: DownloadEntry) => {
				const { imageCols, imageRows, width, height } = download.representation as ImageRepresentation;
				if (!imageCols || !imageRows || !width || !height) {
					if (showProgress) {
						thumbnailProgressBar.increment();
					}
					return;
				}

				// Split into individual images
				const imageName = download.destFile.split(".")[0];
				const data = await fs.readFile(path.resolve(download.destDir, download.destFile));
				const thumbs: Array<ThumbnailBuffer> = [];
				const thumbWidth = width / imageCols;
				const thumbHeight = height / imageRows;
				let index = 0;
				for (let row = 0; row < imageRows; row += 1) {
					for (let col = 0; col < imageCols; col += 1) {
						const jimpImg = await Jimp.read(data);
						if (jimpImg.width < thumbWidth || jimpImg.height < thumbHeight) {
							this.logger.warn(
								`Image ${imageName} is smaller than expected. Expected ${width}x${height} but read ${jimpImg.width}x${jimpImg.height}. Skipping thumbnail extraction.`,
							);
							continue;
						}
						const img = jimpImg.crop({
							x: col * thumbWidth,
							y: row * thumbHeight,
							w: thumbWidth,
							h: thumbHeight,
						});
						const buff = await img.getBuffer("image/png");
						const filePath = path.resolve(download.destDir, `thumb_${imageName}_${index}.png`);
						await fs.writeFile(filePath, buff);
						thumbs.push({
							buffer: buff,
							filePath,
							hash: img.hash(),
						});
						index++;
					}

					this.checkForDuplicates(thumbs, report, download.representation.id);
				}
				if (showProgress) {
					thumbnailProgressBar.increment();
				}
			});

		thumbnailProgressBar.stop();
	}

	private checkForDuplicates(thumbs: Array<ThumbnailBuffer>, report: Report, representationId: string) {
		for (let i = 0; i < thumbs.length; i += 1) {
			const target = thumbs[i];
			if (!target) {
				continue;
			}
			for (let j = 0; j < thumbs.length; j += 1) {
				if (j === i) {
					continue;
				}
				const candidate = thumbs[j];

				if (candidate?.hash === target.hash) {
					report.addDuplicateThumbnail(representationId, candidate.filePath, target.filePath);
				}
			}
		}
	}
}
