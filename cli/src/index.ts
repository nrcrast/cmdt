import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import axios from "axios";
import {
	type AbsoluteTimeRange,
	type DownloadMode,
	getManifestParser,
	LogLevel,
	latestWindowToTimeRange,
	type Manifest,
	type PluginArtifact,
	Report,
	SegmentDownloader,
	secondsToTimeRange,
	setLogLevel,
	wrapUrl,
} from "cmdt-shared";
import { mkdirp } from "mkdirp";
import { rimraf } from "rimraf";
import { getOpts } from "./cli-opts.js";
import { getInstance as getLogger } from "./logger.js";
import { loadPlugins } from "./plugins/load-plugins.js";

const options = getOpts();

// Mirror the CLI's --log-level onto the shared engine so its loggers honor the
// same verbosity as the winston CLI logger (they log independently via tslog).
const CLI_LEVEL_TO_LOG_LEVEL: Record<string, LogLevel> = {
	off: LogLevel.Silent,
	error: LogLevel.Error,
	info: LogLevel.Info,
	debug: LogLevel.Debug,
};
setLogLevel(CLI_LEVEL_TO_LOG_LEVEL[options.logLevel] ?? LogLevel.Info);

const logger = getLogger();
const report = new Report();

type FilesystemArtifact = {
	path: string;
} & PluginArtifact;

/**
 * When pasting a URI from your dev tools, sometimes it seems to jam weird escape characters into the search params
 * @param uri
 * @returns
 */
function sanitizeUri(uri: string): string {
	return uri.replaceAll("\\", "");
}

/**
 * Normalizes a manifest URI so it is always a valid absolute URL string.
 * Bare local paths are converted to absolute file:// URLs; http(s) and file://
 * URIs are returned unchanged. This prevents wrapUrl from throwing on raw paths.
 * @param uri - The manifest URI (http(s) URL, file:// URL, or local path)
 * @returns An absolute URL string
 */
function normalizeManifestUri(uri: string): string {
	if (uri.startsWith("http") || uri.startsWith("file:")) {
		return uri;
	}
	return pathToFileURL(path.resolve(uri)).href;
}

async function fetchManifest(uri: string): Promise<string> {
	if (uri.startsWith("file:")) {
		const filePath = fileURLToPath(uri);
		logger.info(`Reading manifest from ${filePath}`);
		return fs.readFile(filePath, "utf-8");
	}
	if (!uri.startsWith("http")) {
		logger.info(`Reading manifest from ${path.resolve(uri)}`);
		return fs.readFile(path.resolve(uri), "utf-8");
	}
	logger.info(`Fetching manifest from ${uri}`);
	try {
		const response = await axios.get(uri);
		return response.data;
	} catch (e) {
		logger.error(`Failed to fetch manifest from ${uri}`, e);
		process.exit(1);
	}
}

async function cleanupOutputDirectory() {
	logger.debug(`Removing ${options.output}`);
	await rimraf(options.output);
	await mkdirp(options.output);
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

/**
 * Resolves the CLI time-range flags into the absolute (millisecond) range the
 * downloader understands. `--live-edge-window` is resolved against the parsed
 * manifest's live edge; the absolute `--range-*` flags are converted from
 * seconds. Returns undefined when no range flag was supplied (download all).
 */
function resolveDownloadTimeRange(manifest: Manifest): AbsoluteTimeRange | undefined {
	if (options.liveEdgeWindow !== undefined) {
		const range = latestWindowToTimeRange(manifest, options.liveEdgeWindow);
		logger.info(
			`Restricting download to the latest ${options.liveEdgeWindow}s from the live edge (>= ${range.start}ms).`,
		);
		return range;
	}

	if (options.rangeStart === undefined && options.rangeEnd === undefined) {
		return undefined;
	}

	const startSeconds = options.rangeStart ?? 0;
	if (options.rangeEnd !== undefined && startSeconds >= options.rangeEnd) {
		logger.error(`--range-start (${startSeconds}s) must be less than --range-end (${options.rangeEnd}s).`);
		process.exit(1);
	}

	const range = secondsToTimeRange(startSeconds, options.rangeEnd);
	const endLabel = range.end === undefined ? "end of stream" : `${range.end}ms`;
	logger.info(`Restricting download to segments in [${range.start}ms, ${endLabel}).`);
	return range;
}

async function processManifest(uri: string) {
	await cleanupOutputDirectory();
	const sanitizedUri = normalizeManifestUri(sanitizeUri(uri));
	const manifestText = await fetchManifest(sanitizedUri);
	const parser = getManifestParser(sanitizedUri);
	const baseUrl = normalizeCustomBaseUrl(options.baseUrl);
	const { manifest, artifacts } = await parser.parse(manifestText, sanitizedUri, baseUrl);
	await fs.writeFile(path.resolve(options.output, "manifest.json"), JSON.stringify(manifest, null, 2));
	logger.info("Manifest parsed successfully!");
	const plugins = await loadPlugins(manifest, report);
	const downloader = new SegmentDownloader(manifest);
	const downloadTimeRange = resolveDownloadTimeRange(manifest);

	const fsArtifacts: Array<FilesystemArtifact> = artifacts.map((artifact) => {
		return {
			...artifact,
			path: "manifest-parser",
		};
	});

	await downloader.start({
		batchSize: 5,
		downloadMode: options.mode as DownloadMode,
		downloadTimeRange,
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

	for (const plugin of plugins) {
		const pluginArtifacts = await plugin.finalize();
		fsArtifacts.push(
			...pluginArtifacts.map((artifact) => {
				return {
					...artifact,
					path: plugin.name,
				};
			}),
		);
	}

	for (const artifact of fsArtifacts) {
		const artifactPath = path.resolve(options.output, artifact.path, artifact.name);
		await mkdirp(path.dirname(artifactPath));
		await fs.writeFile(
			artifactPath,
			typeof artifact.content === "string" ? artifact.content : Buffer.from(artifact.content),
		);
		logger.info(`Wrote ${artifact.name} to ${artifactPath}`);
	}

	report.ingestManifest(manifest);
	const reportRaw = await report.getRaw();
	await fs.writeFile(path.resolve(options.output, "report.cmdt"), JSON.stringify(reportRaw, null, 2));

	if (options.logPeriods) {
		// biome-ignore lint/suspicious/noConsole: using console.table to print the data out
		console.table(manifest.periods, ["id", "startString", "start", "duration", "end", "startPrevEnd", "periodOverlap"]);
	}

	logger.info("Done!");
}

processManifest(options.manifest);
