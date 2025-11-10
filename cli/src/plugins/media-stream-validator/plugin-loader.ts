import type { Manifest } from "cmdt-shared";
import { getOpts } from "../../cli-opts.js";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import { MediaStreamValidator } from "../../media-stream-validator/media-stream-validator.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";

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
