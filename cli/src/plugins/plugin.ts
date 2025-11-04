import type { Manifest } from "cmdt-shared";
import { glob } from "glob";
import type { DownloadQueue } from "../download-queue.js";
import { getInstance as getLogger } from "../logger.js";
import type { Report } from "../report.js";

const pluginRegistry: Record<string, Plugin> = {};
const logger = getLogger();

export abstract class Plugin {
	constructor(
		protected manifest: Manifest,
		protected report: Report,
		protected downloads: DownloadQueue,
		name: string,
	) {
		registerPlugin(name, this);
	}
	abstract run(): Promise<void>;
}

export async function loadPlugins(manifest: Manifest, report: Report, downloads: DownloadQueue) {
	const pluginFiles = glob.sync("./**/plugin-loader.ts", { absolute: true });
	for (const pluginFile of pluginFiles) {
		const mod = await import(pluginFile);
		mod.default(manifest, report, downloads);
	}
}

export function registerPlugin(name: string, plugin: Plugin) {
	logger.info(`Registering plugin ${name}`);
	pluginRegistry[name] = plugin;
}

export async function runPlugins() {
	for (const plugin of Object.values(pluginRegistry)) {
		await plugin.run();
	}
}
