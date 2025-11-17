import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { ThumbnailExtractor } from "./thumbnail-extractor.js";

/**
 * Plugin for extracting and processing thumbnail images from downloaded image segments.
 *
 * This plugin processes downloaded image segments that contain thumbnail sprite sheets (tiled images)
 * and extracts individual thumbnail images from them. It handles image representations with multiple
 * rows and columns, splits the sprite sheets into individual thumbnails, detects duplicate thumbnails
 * using hash comparison, and saves the extracted images to disk for use in video players and other
 * applications.
 *
 * @example
 * // The plugin is automatically loaded and executed when --thumbnails flag is set
 * // It processes all image segments and extracts individual thumbnails from sprite sheets
 *
 * @see {@link ThumbnailExtractor} for the core extraction and deduplication logic
 * @see {@link ImageRepresentation} for image segment metadata (rows, columns, dimensions)
 */
class ThumbnailExtractorPlugin extends Plugin {
	private logger = getLogger();
	private thumbnailExtractor: ThumbnailExtractor;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "thumbnail-extractor");
		this.thumbnailExtractor = new ThumbnailExtractor();
	}

	public async run(): Promise<void> {
		this.logger.info("Running thumbnail extractor plugin...");
		await this.thumbnailExtractor.extractFromDownloadedSegments(this.downloads, this.report);
		this.logger.info("Thumbnail extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new ThumbnailExtractorPlugin(manifest, report, downloads);
}
