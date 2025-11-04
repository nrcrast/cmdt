import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { ThumbnailExtractor } from "./thumbnail-extractor.js";

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
