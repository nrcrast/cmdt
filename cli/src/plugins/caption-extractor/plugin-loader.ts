import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { CaptionExtractor } from "./caption-extractor.js";

/**
 * Plugin for extracting and validating closed captions from downloaded video segments.
 *
 * This plugin extracts closed caption data (CEA-608 and CEA-708) embedded in downloaded
 * video segments. It parses the caption streams from the media segments, decodes the
 * caption data, and validates that the extracted captions match the manifest's caption
 * declarations. Extracted captions are saved to files for further processing and analysis.
 *
 * @example
 * // The plugin is automatically loaded and executed as part of the plugin system
 * // It processes all video segments, extracts captions, and validates them
 *
 * @see {@link CaptionExtractor} for the core extraction and validation logic
 * @see {@link CeaParser} for CEA-608/708 caption parsing
 * @see {@link Cue} for caption cue structure
 */
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
		this.captionExtractor.validate();
		this.logger.info("Caption extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new CaptionExtractorPlugin(manifest, report, downloads);
}
