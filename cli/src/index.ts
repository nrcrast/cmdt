import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { mkdirp } from "mkdirp";
import { rimraf } from "rimraf";
import { CaptionExtractor } from "./caption-extractor.js";
import { getOpts } from "./cli-opts.js";
import { DashIfConformance } from "./dash-if-conformance/dash-if-conformance.js";
import { SegmentDownloader } from "./downloader.js";
import { EmsgExtractor } from "./emsg-extractor.js";
import { GapChecker } from "./gap-checker.js";
import { getInstance as getLogger } from "./logger.js";
import { DashManifest } from "./manifest-parsers/dash/dash.js";
import { HlsManifest } from "./manifest-parsers/hls.js";
import { MediaStreamValidator } from "./media-stream-validator/media-stream-validator.js";
import { Report } from "./report.js";
import { ThumbnailExtractor } from "./thumbnail-extractor.js";
import { wrapUrl } from "./utils/url.js";

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
		const response = await axios.get(uri);
		const parsedUrl = wrapUrl(uri);
		const existingExtension = parsedUrl.pathname.split(".").pop() ?? "mpd";
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

function isDash(manifestUri: string): boolean {
	return manifestUri.includes(".mpd");
}

async function processManifest(uri: string) {
	await cleanupOutputDirectory();
	const sanitizedUri = sanitizeUri(uri);
	const dash = isDash(sanitizedUri);
	const manifestText = await fetchAndWriteManifest(sanitizedUri);
	const parser = dash ? new DashManifest() : new HlsManifest();
	const manifest = await parser.parse(manifestText, sanitizedUri);
	await fs.writeFile(path.resolve(options.output, "manifest.json"), JSON.stringify(manifest, null, 2));
	logger.info("Manifest parsed successfully!");
	const downloader = new SegmentDownloader(manifest);
	const downloads = await downloader.download();

	if (dash && options.dashConformance) {
		const conformance = new DashIfConformance(manifestText);
		await conformance.run(report);
	}

	const captionExtractor = new CaptionExtractor(manifest, report);
	await captionExtractor.extractFromDownloadedSegments();
	await captionExtractor.validate();

	const gapChecker = new GapChecker(manifest);
	await gapChecker.analyzeGaps(report);

	const emsgExtractor = new EmsgExtractor();
	await emsgExtractor.extractEmsgFromDownloadedSegments(downloads, report);

	const thumbnailExtractor = new ThumbnailExtractor();
	await thumbnailExtractor.extractFromDownloadedSegments(downloads, report);

	if (options.mediaStreamValidator && !dash) {
		const mediaStreamValidator = new MediaStreamValidator();
		const isFound = await mediaStreamValidator.checkForValidator();
		if (isFound) {
			logger.info("Running media stream validator...");
			await mediaStreamValidator.validate(sanitizedUri, report);
		} else {
			logger.error("Media stream validator not found. Please install it and try again.");
		}
	}

	report.ingestManifest(manifest);
	await report.write(path.resolve(options.output, "report.cmdt"));

	if (options.logPeriods) {
		// biome-ignore lint/suspicious/noConsole: using console.table to print the data out
		console.table(manifest.periods, ["id", "startString", "start", "duration", "end", "startPrevEnd", "periodOverlap"]);
	}

	logger.info("Done!");
}

processManifest(options.manifest);
