import { Manifest } from "cmdt-shared";
import { Report } from "../report.js";
import {glob } from "glob";
import type { DownloadEntry } from "../downloader.js";

const pluginRegistry: Record<string, Plugin> = {};

export abstract class Plugin {
    constructor(protected manifest: Manifest, protected report: Report, name: string) {
        registerPlugin(name, this);
    }
	abstract run(): Promise<void>;
}

export async function loadPlugins(manifest: Manifest, report: Report, downloads: Array<DownloadEntry>) {
    const pluginFiles = glob.sync("./**/plugin-loader.ts", { absolute: true });
	for (const pluginFile of pluginFiles) {
		const mod = await import(pluginFile);
        const plugin = mod.default(manifest, report);
		// Set downloads for plugins that need it
		if (typeof (plugin as any).setDownloads === "function") {
			(plugin as any).setDownloads(downloads);
		}
		// Set URI for plugins that need it
		if (typeof (plugin as any).setUri === "function") {
			(plugin as any).setUri(manifest.url.href);
		}
	}
}

export function registerPlugin(name: string, plugin: Plugin) {
    console.log(`Registering plugin ${name}`);
	pluginRegistry[name] = plugin;
}

export async function runPlugins() {
	for (const plugin of Object.values(pluginRegistry)) {
		await plugin.run();
	}
}
