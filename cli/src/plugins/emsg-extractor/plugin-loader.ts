import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { EmsgExtractor } from "./emsg-extractor.js";

/**
 * Plugin for extracting EMSG (Event Message) boxes from downloaded video segments.
 *
 * This plugin analyzes downloaded MP4 video segments to extract EMSG boxes, which contain
 * event messages and metadata that may be embedded in the media stream. These messages can
 * include timing information, ad markers, or other application-specific events. The plugin
 * decodes the message data and reports all extracted events for analysis and validation.
 *
 * @example
 * // The plugin is automatically loaded and executed as part of the plugin system
 * // It processes all video segments and extracts embedded event messages
 *
 * @see {@link EmsgExtractor} for the core extraction logic
 * @see {@link Emsg} for the EMSG box structure
 */
class EmsgExtractorPlugin extends Plugin {
	private logger = getLogger();
	private emsgExtractor: EmsgExtractor;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "emsg-extractor");
		this.emsgExtractor = new EmsgExtractor();
	}

	public async run(): Promise<void> {
		this.logger.info("Running emsg extractor plugin...");
		await this.emsgExtractor.extractEmsgFromDownloadedSegments(this.downloads, this.report);
		this.logger.info("Emsg extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new EmsgExtractorPlugin(manifest, report, downloads);
}
