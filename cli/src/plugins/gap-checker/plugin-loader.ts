import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { GapChecker } from "./gap-checker.js";

/**
 * Plugin for detecting temporal gaps and discontinuities in media segments.
 *
 * This plugin analyzes the timing information in downloaded video segments to identify
 * gaps or overlaps between consecutive segments. It parses MP4 box metadata to extract
 * decode timestamps and durations, then compares them against the manifest's declared
 * segment timing. Gaps exceeding a configurable tolerance threshold (100ms) are reported
 * for debugging and validation purposes.
 *
 * @example
 * // The plugin is automatically loaded and executed as part of the plugin system
 * // It processes all video segments and reports any timing discontinuities
 *
 * @see {@link GapChecker} for the core gap detection logic
 * @see {@link Segment} for segment timing information
 */
class GapCheckerPlugin extends Plugin {
	private logger = getLogger();
	private gapChecker: GapChecker;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "gap-checker");
		this.gapChecker = new GapChecker(manifest);
	}

	public async run(): Promise<void> {
		this.logger.info("Running gap checker plugin...");
		await this.gapChecker.analyzeGaps(this.report);
		this.logger.info("Gap checker plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new GapCheckerPlugin(manifest, report, downloads);
}
