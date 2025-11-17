/**
 * Plugin architecture for CMDT (Content Manifest Diagnostic Tool).
 *
 * This module provides a flexible plugin system that allows for modular analysis and validation
 * of media manifests and downloaded segments. Plugins are automatically discovered, loaded, and
 * executed in a standardized way.
 *
 * ## Plugin Architecture
 *
 * The plugin system follows these principles:
 * - **Auto-discovery**: Plugins are automatically discovered by scanning for `plugin-loader.ts` files
 * - **Registration**: Each plugin registers itself in the plugin registry during construction
 * - **Sequential execution**: Plugins run sequentially in the order they were registered
 * - **Shared context**: All plugins have access to the manifest, report, and download queue
 *
 * ## Creating a Plugin
 *
 * To create a new plugin:
 * 1. Create a directory under `cli/src/plugins/` (e.g., `my-plugin/`)
 * 2. Create a `plugin-loader.ts` file that exports a default function
 * 3. Create a class that extends the `Plugin` abstract class
 * 4. Implement the `run()` method with your plugin logic
 *
 * @example
 * // Example plugin-loader.ts
 * import { Plugin } from "../plugin.js";
 *
 * class MyPlugin extends Plugin {
 *   constructor(manifest, report, downloads) {
 *     super(manifest, report, downloads, "my-plugin");
 *   }
 *
 *   async run() {
 *     // Plugin logic here
 *   }
 * }
 *
 * export default function load(manifest, report, downloads) {
 *   return new MyPlugin(manifest, report, downloads);
 * }
 *
 * @module plugins/plugin
 */

import type { Manifest } from "cmdt-shared";
import { glob } from "glob";
import type { DownloadQueue } from "../download-queue.js";
import { getInstance as getLogger } from "../logger.js";
import type { Report } from "../report.js";

/**
 * Internal registry that stores all loaded plugins by name.
 * Plugins are registered automatically during construction.
 */
const pluginRegistry: Record<string, Plugin> = {};
const logger = getLogger();

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
	/**
	 * Creates a new plugin instance and registers it in the plugin registry.
	 *
	 * @param manifest - The parsed media manifest (DASH or HLS)
	 * @param report - The report object for storing analysis results
	 * @param downloads - The download queue containing all downloaded segments
	 * @param name - Unique identifier for this plugin (used for logging and registry)
	 */
	constructor(
		protected manifest: Manifest,
		protected report: Report,
		protected downloads: DownloadQueue,
		name: string,
	) {
		registerPlugin(name, this);
	}

	/**
	 * Executes the plugin's main logic.
	 *
	 * This method is called by `runPlugins()` and should contain all the plugin's
	 * analysis, validation, or processing logic. Implementations should be idempotent
	 * and handle errors gracefully.
	 *
	 * @returns A promise that resolves when the plugin has completed its work
	 */
	abstract run(): Promise<void>;
}

/**
 * Discovers and loads all plugins from the plugins directory.
 *
 * This function scans for all `plugin-loader.ts` files in the plugins directory tree,
 * dynamically imports them, and calls their default export function to instantiate
 * the plugin. Each plugin automatically registers itself during construction.
 *
 * @param manifest - The parsed media manifest to pass to plugins
 * @param report - The report object to pass to plugins
 * @param downloads - The download queue to pass to plugins
 *
 * @example
 * const manifest = await parseManifest(url);
 * const downloads = await downloadSegments(manifest);
 * const report = new Report(manifest);
 *
 * await loadPlugins(manifest, report, downloads);
 * await runPlugins();
 */
export async function loadPlugins(manifest: Manifest, report: Report, downloads: DownloadQueue) {
	const pluginFiles = glob.sync("./**/plugin-loader.ts", { absolute: true });
	for (const pluginFile of pluginFiles) {
		const mod = await import(pluginFile);
		mod.default(manifest, report, downloads);
	}
}

/**
 * Registers a plugin in the internal plugin registry.
 *
 * This function is called automatically by the Plugin constructor and should not
 * be called directly. It adds the plugin to the registry so it can be executed
 * by `runPlugins()`.
 *
 * @param name - Unique identifier for the plugin
 * @param plugin - The plugin instance to register
 *
 * @internal
 */
export function registerPlugin(name: string, plugin: Plugin) {
	logger.info(`Registering plugin ${name}`);
	pluginRegistry[name] = plugin;
}

/**
 * Executes all registered plugins sequentially.
 *
 * This function iterates through all plugins in the registry and calls their `run()`
 * method in sequence. Plugins are executed in the order they were registered.
 * If a plugin throws an error, it will propagate and stop execution of remaining plugins.
 *
 * @returns A promise that resolves when all plugins have completed
 *
 * @example
 * await loadPlugins(manifest, report, downloads);
 * await runPlugins(); // Executes all loaded plugins
 */
export async function runPlugins() {
	for (const plugin of Object.values(pluginRegistry)) {
		await plugin.run();
	}
}
