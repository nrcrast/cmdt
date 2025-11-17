import type { Manifest } from "cmdt-shared";
import { getOpts } from "../../cli-opts.js";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import { MediaStreamValidator } from "../../media-stream-validator/media-stream-validator.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";

/**
 * Plugin for validating HLS (HTTP Live Streaming) manifests using Apple's mediastreamvalidator tool.
 *
 * This plugin integrates with Apple's official mediastreamvalidator command-line tool to validate
 * HLS manifests (.m3u8 files) for compliance with the HLS specification. It checks for proper
 * segment formatting, playlist structure, codec compatibility, and other HLS-specific requirements.
 * The validation results are saved to a JSON file and included in the report. This plugin only
 * runs for HLS manifests when the --mediaStreamValidator flag is set and the tool is installed.
 *
 * @example
 * // The plugin is automatically loaded and executed when --mediaStreamValidator flag is set
 * // and the manifest is an HLS manifest (.m3u8)
 * // Requires Apple's mediastreamvalidator to be installed on the system
 *
 * @see {@link MediaStreamValidator} for the core validation logic
 * @see {@link https://developer.apple.com/documentation/http_live_streaming} HLS Specification
 * @see {@link Report.setMediaStreamValidatorReport} for how results are stored
 */
class MediaStreamValidatorPlugin extends Plugin {
	private logger = getLogger();
	private mediaStreamValidator: MediaStreamValidator;

	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "media-stream-validator");
		this.mediaStreamValidator = new MediaStreamValidator();
	}

	public async run(): Promise<void> {
		// Only run for HLS manifests when option is enabled
		if (getOpts().mediaStreamValidator && this.manifest.url.pathname.toLocaleLowerCase().includes(".m3u8")) {
			this.logger.info("Running media stream validator plugin...");
			const isFound = await this.mediaStreamValidator.checkForValidator();
			if (isFound) {
				await this.mediaStreamValidator.validate(this.manifest.url.href, this.report);
				this.logger.info("Media stream validator plugin finished");
			} else {
				this.logger.error("Media stream validator not found. Please install it and try again.");
			}
		} else {
			this.logger.debug("Skipping media stream validator plugin");
		}
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new MediaStreamValidatorPlugin(manifest, report, downloads);
}
