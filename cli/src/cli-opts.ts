import { Command, Option } from "@commander-js/extra-typings";

const program = new Command()
	.requiredOption("-m, --manifest <string>", "Manifest URI. Can also be a local path.")
	.option("-b, --base-url <string>", "Base URL for relative URIs in manifest, if using local manifest.")
	.option("-o, --output <string>", "Output directory", "download")
	.option("-s, --skip-download", "Skip download (debug)")
	.addOption(
		new Option("-l, --log-level <logLevel>", "Log Level").choices(["off", "error", "info", "debug"]).default("info"),
	)
	.option("--dash-conformance", "Run DASH-IF conformance tool (DASH only)")
	.option("-t, --thumbnails", "Validate thumbnails (check for duplicates)")
	.option("--media-stream-validator", "Run apple's media stream validator (HLS only)")
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
