import { Command, Option } from "@commander-js/extra-typings";
import { DownloadMode, DownloadModeInfo } from "cmdt-shared";

const modeDescription = [
	"Download mode:",
	...Object.values(DownloadMode).map((mode) => `  ${mode} — ${DownloadModeInfo[mode].short}`),
].join("\n");

const program = new Command()
	.requiredOption("-m, --manifest <string>", "Manifest URI. Can also be a local path.")
	.option("-b, --base-url <string>", "Base URL for relative URIs in manifest, if using local manifest.")
	.option("-o, --output <string>", "Output directory", "download")
	.addOption(
		new Option("-d, --mode <downloadMode>", modeDescription)
			.choices(Object.values(DownloadMode) as string[])
			.default("full"),
	)
	.addOption(
		new Option("-l, --log-level <logLevel>", "Log Level").choices(["off", "error", "info", "debug"]).default("info"),
	)
	.option("-p, --log-periods", "Print a table of periods in DASH manifests");

type CliOpts = ReturnType<typeof program.opts>;

let opts: CliOpts | undefined;

export function getOpts(): CliOpts {
	if (opts) {
		return opts;
	} else {
		program.parse(process.argv);
		opts = program.opts();
		return opts;
	}
}
