import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { GapChecker } from "./gap-checker.js";

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
