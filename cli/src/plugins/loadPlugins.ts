import { Manifest } from "cmdt-shared";
import { FilesystemWriter } from "./filesystem-writer/filesystem-writer.js";
import { CaptionExtractor, EmsgExtractor, PsshExtractor, GapChecker, Plugin, Report } from "cmdt-shared";

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
export async function loadPlugins(manifest: Manifest, report: Report): Promise<Plugin[]> {
	
	const plugins: Plugin[] = [];
	plugins.push(new CaptionExtractor(manifest, report));
	plugins.push(new FilesystemWriter(manifest, report));
	plugins.push(new EmsgExtractor(manifest, report));
	plugins.push(new PsshExtractor(manifest, report));
	plugins.push(new GapChecker(manifest, report));
	return plugins;
}

