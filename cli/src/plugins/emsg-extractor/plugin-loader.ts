import type { Manifest } from "cmdt-shared";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { EmsgExtractor } from "./emsg-extractor.js";

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
