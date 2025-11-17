import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import type { Manifest } from "cmdt-shared";
import { getOpts } from "../../cli-opts.js";
import type { DownloadQueue } from "../../download-queue.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { Plugin } from "../plugin.js";

/**
 * Plugin for validating DASH manifests against DASH-IF (DASH Industry Forum) conformance standards.
 *
 * This plugin submits the DASH manifest (MPD) to the official DASH-IF conformance validation service
 * to verify compliance with DASH and IOP (Interoperability Points) specifications. It validates the
 * manifest structure, syntax, and adherence to industry standards using Schematron rules and other
 * validation modules. The conformance results are saved to a JSON file and included in the report.
 *
 * @example
 * // The plugin is automatically loaded and executed when --dashConformance flag is set
 * // It submits the manifest to https://conformance.dashif.org and reports validation results
 *
 * @see {@link https://conformance.dashif.org} DASH-IF Conformance Tool
 * @see {@link Report.setDashConformanceReport} for how results are stored
 */
class DashIfConformance extends Plugin {
	private logger = getLogger();
	constructor(manifest: Manifest, report: Report, downloads: DownloadQueue) {
		super(manifest, report, downloads, "dash-if-conformance");
	}
	public async run(): Promise<void> {
		if (!getOpts().dashConformance) {
			this.logger.warn("Skipping DASH-IF conformance");
			return;
		}
		this.logger.info("Running DASH-IF conformance tool...");
		var bodyFormData = new FormData();
		bodyFormData.append("mpd", this.manifest.raw);
		bodyFormData.append("dash", "1");
		bodyFormData.append("iop", "1");
		// biome-ignore lint/suspicious/noExplicitAny: Data is pass-through
		let respData: any;
		try {
			const resp = await axios({
				method: "POST",
				data: bodyFormData,
				url: "https://conformance.dashif.org/Utils/Process_cli.php",
				headers: { "Content-Type": "multipart/form-data" },
			});
			respData = resp.data;
		} catch (e) {
			this.logger.error("Error running DASH-IF conformance tool", e);
			process.exit(1);
		}
		const opts = getOpts();

		const savePath = path.resolve(opts.output, "dash-if-conformance.json");

		await fs.writeFile(savePath, JSON.stringify(respData, null, 2));

		if (respData.entries.Schematron) {
			this.logger.info(`    DASH-IF Conformance Tool | Schematron verdict: ${respData.entries.Schematron.verdict}`);
		}

		for (const mod of respData.enabled_modules) {
			if (respData.entries[mod.name]) {
				this.logger.info(`    DASH-IF Conformance Tool | ${mod.name} verdict: ${respData.entries[mod.name].verdict}`);
			}
		}

		this.logger.info(`DASH-IF Conformance Tool finished and saved results to ${savePath}`);
		this.report.setDashConformanceReport(respData);
	}
}

export default function load(manifest: Manifest, report: Report, downloads: DownloadQueue): Plugin {
	return new DashIfConformance(manifest, report, downloads);
}
