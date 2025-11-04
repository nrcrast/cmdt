import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { CaptionExtractor } from "./caption-extractor.js";

class CaptionExtractorPlugin extends Plugin {
	private logger = getLogger();
	private captionExtractor: CaptionExtractor;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "caption-extractor");
		this.captionExtractor = new CaptionExtractor(manifest, report);
	}

	public async run(): Promise<void> {
		this.logger.info("Running caption extractor plugin...");
		await this.captionExtractor.extractFromDownloadedSegments();
		await this.captionExtractor.validate();
		this.logger.info("Caption extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new CaptionExtractorPlugin(manifest, report, downloads);
}
