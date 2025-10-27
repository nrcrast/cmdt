import { Manifest } from "cmdt-shared";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { ThumbnailExtractor } from "./thumbnail-extractor.js";
import type { DownloadEntry } from "../../downloader.js";

class ThumbnailExtractorPlugin extends Plugin {
	private logger = getLogger();
	private thumbnailExtractor: ThumbnailExtractor;
	private downloads: Array<DownloadEntry> = [];

	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "thumbnail-extractor");
		this.thumbnailExtractor = new ThumbnailExtractor();
	}

	public setDownloads(downloads: Array<DownloadEntry>): void {
		this.downloads = downloads;
	}

	public async run(): Promise<void> {
		this.logger.info("Running thumbnail extractor plugin...");
		await this.thumbnailExtractor.extractFromDownloadedSegments(this.downloads, this.report);
		this.logger.info("Thumbnail extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report): Plugin {
	return new ThumbnailExtractorPlugin(manifest, report);
}

