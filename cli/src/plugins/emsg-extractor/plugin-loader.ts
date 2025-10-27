import { Manifest } from "cmdt-shared";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";
import { EmsgExtractor } from "./emsg-extractor.js";
import type { DownloadEntry } from "../../downloader.js";

class EmsgExtractorPlugin extends Plugin {
	private logger = getLogger();
	private emsgExtractor: EmsgExtractor;
	private downloads: Array<DownloadEntry> = [];

	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "emsg-extractor");
		this.emsgExtractor = new EmsgExtractor();
	}

	public setDownloads(downloads: Array<DownloadEntry>): void {
		this.downloads = downloads;
	}

	public async run(): Promise<void> {
		this.logger.info("Running emsg extractor plugin...");
		await this.emsgExtractor.extractEmsgFromDownloadedSegments(this.downloads, this.report);
		this.logger.info("Emsg extractor plugin finished");
	}
}

export default function load(manifest: Manifest, report: Report): Plugin {
	return new EmsgExtractorPlugin(manifest, report);
}

