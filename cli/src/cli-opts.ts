import { Command, InvalidArgumentError, Option } from "@commander-js/extra-typings";
import { DownloadMode, DownloadModeInfo } from "cmdt-shared";

const modeDescription = [
	"Download mode:",
	...Object.values(DownloadMode).map((mode) => `  ${mode} — ${DownloadModeInfo[mode].short}`),
].join("\n");

/**
 * Commander arg parser for a non-negative number of seconds. Rejects malformed
 * or negative input so time-range flags fail fast with a clear message.
 */
function parseSeconds(value: string): number {
	const seconds = Number.parseFloat(value);
	if (!Number.isFinite(seconds) || seconds < 0) {
		throw new InvalidArgumentError("Expected a non-negative number of seconds.");
	}
	return seconds;
}

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
		new Option(
			"--range-start <seconds>",
			"Only download segments at or after this presentation time (seconds). Absolute range; conflicts with --live-edge-window.",
		)
			.argParser(parseSeconds)
			.conflicts("liveEdgeWindow"),
	)
	.addOption(
		new Option(
			"--range-end <seconds>",
			"Only download segments before this presentation time (seconds). Defaults to the end of the stream. Conflicts with --live-edge-window.",
		)
			.argParser(parseSeconds)
			.conflicts("liveEdgeWindow"),
	)
	.addOption(
		new Option(
			"--live-edge-window <seconds>",
			"Live content: only download the latest N seconds from the live edge. Conflicts with --range-start/--range-end.",
		).argParser(parseSeconds),
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
