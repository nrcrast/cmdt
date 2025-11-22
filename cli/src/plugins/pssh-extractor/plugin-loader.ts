import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { PsshExtractor } from "./pssh-extractor.js";

/**
 * Plugin for extracting PSSH (Protection System Specific Header) boxes from downloaded video segments.
 *
 * This plugin analyzes downloaded MP4 video segments to extract PSSH boxes, which contain
 * DRM (Digital Rights Management) information including Widevine and PlayReady protection data.
 * It validates that the PSSH data found in the segments matches the content protection
 * declarations in the manifest, reporting any mismatches for debugging and validation purposes.
 *
 * @example
 * // The plugin is automatically loaded and executed as part of the plugin system
 * // It processes all video segments and generates a report of content protection mismatches
 *
 * @see {@link PsshExtractor} for the core extraction logic
 * @see {@link PlayreadyData} for PlayReady DRM data structure
 * @see {@link WidevineData} for Widevine DRM data structure
 */
class PsshExtractorPlugin extends Plugin {
	private logger = getLogger();
	private psshExtractor: PsshExtractor;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "pssh-extractor");
		this.psshExtractor = new PsshExtractor();
	}

	public async run(): Promise<void> {
		this.logger.info("Running pssh extractor plugin...");
		await this.psshExtractor.extractPsshFromDownloadedSegments(this.manifest, this.downloads, this.report);
		this.logger.info("Pssh extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new PsshExtractorPlugin(manifest, report, downloads);
}
