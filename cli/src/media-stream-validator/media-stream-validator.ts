import "zx/globals";
import type winston from "winston";
import { getOpts } from "../cli-opts.js";
import { getInstance as getLogger } from "../logger.js";
import type { Report } from "cmdt-shared";

const $$ = $({
	quiet: true,
});

export class MediaStreamValidator {
	private logger: winston.Logger;
	constructor() {
		this.logger = getLogger();
	}
	public async checkForValidator() {
		try {
			await $$`mediastreamvalidator --version`;
			return true;
		} catch (p) {
			this.logger.warn(`Error checking for mediastreamvalidator: ${p}`);
			return false;
		}
	}

	public async validate(uri: string, report: Report) {
		const outputPath = path.resolve(getOpts().output, "media-stream-validator-results.json");
		this.logger.info(`Logging media stream validator results to ${outputPath}`);
		await spinner(
			"working...",
			() => $$`mediastreamvalidator --validation-data-path="${outputPath}" --timeout 10 ${uri}`,
		);
		const msvReport = await fs.readFile(outputPath, "utf-8");
		const parsedReport = JSON.parse(msvReport);
		report.setMediaStreamValidatorReport(parsedReport);
	}
}
