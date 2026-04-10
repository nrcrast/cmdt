import type { Manifest, Representation, Segment } from "cmdt-shared";
import { getInstance as getLogger } from "../logger.js";
import type { Report } from "../report.js";

import winston from "winston";

export type PluginArtifact = {
	name: string;
	content: string | Buffer;
}

/**
 * Abstract base class for all CMDT plugins.
 *
 * All plugins must extend this class and implement the `run()` method. The constructor
 * automatically registers the plugin in the plugin registry, making it available for
 * execution when `runPlugins()` is called.
 *
 * @abstract
 * @example
 * class MyAnalyzerPlugin extends Plugin {
 *   constructor(manifest, report, downloads) {
 *     super(manifest, report, downloads, "my-analyzer");
 *   }
 *
 *   async run() {
 *     // Analyze segments and add results to report
 *     for (const download of this.downloads.getEntries()) {
 *       // Analysis logic
 *     }
 *   }
 * }
 */
export abstract class Plugin {
	protected logger: winston.Logger;
	/**
	 * Creates a new plugin instance and registers it in the plugin registry.
	 *
	 * @param manifest - The parsed media manifest (DASH or HLS)
	 * @param report - The report object for storing analysis results
	 * @param name - Unique identifier for this plugin (used for logging and registry)
	 */
	constructor(
		protected manifest: Manifest,
		protected report: Report,
		public name: string,
	) {
		this.logger = getLogger();
	}

	public async processSegment(segment: Segment, representation: Representation): Promise<void> {

	}
	public async finalize(): Promise<Array<PluginArtifact>> {
		return [];
	}
}
