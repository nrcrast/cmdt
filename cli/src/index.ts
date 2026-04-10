import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { mkdirp } from "mkdirp";
import { rimraf } from "rimraf";
import { getOpts } from "./cli-opts.js";
import { SegmentDownloader, Report, getManifestParser, getExtensionFromUrl, wrapUrl} from "cmdt-shared";
import { getInstance as getLogger } from "./logger.js";
import { loadPlugins } from "./plugins/loadPlugins.js";

const options = getOpts();
const logger = getLogger();
const report = new Report();

/**
 * When pasting a URI from your dev tools, sometimes it seems to jam weird escape characters into the search params
 * @param uri
 * @returns
 */
function sanitizeUri(uri: string): string {
	return uri.replaceAll("\\", "");
}

async function fetchAndWriteManifest(uri: string): Promise<string> {
	if (!uri.startsWith("http")) {
		logger.info(`Reading manifest from ${path.resolve(uri)}`);
		return fs.readFile(path.resolve(uri), "utf-8");
	}
	logger.info(`Fetching manifest from ${uri}`);
	try {
		const parsedUrl = wrapUrl(uri);
		const existingExtension = getExtensionFromUrl(parsedUrl) ?? "mpd";
		const manifestPath = path.resolve(options.output, `manifest.${existingExtension}`);
		if (options.skipDownload) {
			logger.info(`Skipping download. Using ${manifestPath}`);
			return fs.readFile(manifestPath, "utf-8");
		}
		const response = await axios.get(uri);
		await fs.writeFile(path.resolve(options.output, `manifest.${existingExtension}`), response.data);
		return response.data;
	} catch (e) {
		logger.error(`Failed to fetch manifest from ${uri}`, e);
		process.exit(1);
	}
}

async function cleanupOutputDirectory() {
	if (!options.skipDownload) {
		logger.debug(`Removing ${options.output}`);
		await rimraf(options.output);
		await mkdirp(options.output);
	}
}

/**
 * Normalizes a custom base URL by wrapping it and removing any file extensions from the path.
 * @param baseUrl - The base URL to normalize (optional)
 * @returns The normalized URL as a string, or undefined if no baseUrl is provided
 */
function normalizeCustomBaseUrl(baseUrl?: string): string | undefined {
	// Return early if no baseUrl is provided
	if (!baseUrl) {
		return;
	}
	// Wrap the URL to ensure it's a valid URL object
	const wrapped = wrapUrl(baseUrl);
	// Split the pathname by "/" to get individual path segments
	const splitPath = wrapped.pathname.split("/");
	// Remove the last path segment if it contains a file extension (indicated by a ".")
	if (splitPath[splitPath.length - 1]?.includes(".")) {
		splitPath.pop();
	}
	wrapped.pathname = splitPath.join("/");
	return wrapped.href;
}

async function processManifest(uri: string) {
	await cleanupOutputDirectory();
	const sanitizedUri = sanitizeUri(uri);
	const manifestText = await fetchAndWriteManifest(sanitizedUri);
	const parser = getManifestParser(sanitizedUri);
	const baseUrl = normalizeCustomBaseUrl(options.baseUrl);
	const manifest = await parser.parse(manifestText, sanitizedUri, baseUrl);
	await fs.writeFile(path.resolve(options.output, "manifest.json"), JSON.stringify(manifest, null, 2));
	logger.info("Manifest parsed successfully!");
	const plugins = await loadPlugins(manifest, report);
	const downloader = new SegmentDownloader(manifest);
	

	await downloader.start({
		batchSize: 5, 
		onSegmentAvailable: async (segment, representation) => {
		for (const plugin of plugins) {
			await plugin.processSegment(segment, representation);
		}
		segment.media?.free();
	},
	onProgress: (nSegment, totalSegments) => {
		logger.info(`Downloading segment ${nSegment} of ${totalSegments}`);
	},
});

	logger.info("Finalizing plugins...");

	for(const plugin of plugins) {
		const artifacts = await plugin.finalize();
		for (const artifact of artifacts) {
			const artifactPath = path.resolve(options.output, plugin.name, artifact.name);
			await mkdirp(path.dirname(artifactPath));
			await fs.writeFile(artifactPath, typeof(artifact.content) === "string" ? artifact.content : Buffer.from(artifact.content));
			logger.info(`Wrote ${artifact.name} to ${artifactPath}`);
		}
	}

	report.ingestManifest(manifest);
	const reportStr = await report.asString();
	await fs.writeFile(path.resolve(options.output, "report.json"), reportStr);

	if (options.logPeriods) {
		// biome-ignore lint/suspicious/noConsole: using console.table to print the data out
		console.table(manifest.periods, ["id", "startString", "start", "duration", "end", "startPrevEnd", "periodOverlap"]);
	}

	logger.info("Done!");
}

processManifest(options.manifest);
