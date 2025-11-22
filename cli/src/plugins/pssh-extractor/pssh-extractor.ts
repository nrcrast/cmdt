import fs from "node:fs/promises";
import path from "node:path";
import cliProgress from "cli-progress";
import { type Manifest, MediaType, MismatchedContentProtectionType, type Segment } from "cmdt-shared";
import type winston from "winston";
import { getOpts } from "../../cli-opts.js";
import type { DownloadEntry, DownloadQueue } from "../../download-queue.js";
import type { PlayreadyData } from "../../drm/playready/playready.js";
import { PsshParser } from "../../drm/pssh.js";
import type { WidevineData } from "../../drm/widevine/widevine.js";
import { getInstance as getLogger } from "../../logger.js";
import type { Report } from "../../report.js";
import { canAccessFile } from "../../utils/file.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { ParsedBox } from "../../utils/mp4/types.js";

export class PsshExtractor {
	private logger: winston.Logger;
	constructor() {
		this.logger = getLogger();
	}

	public async extractPsshFromDownloadedSegments(
		manifest: Manifest,
		downloads: DownloadQueue,
		report: Report,
	): Promise<void> {
		this.logger.info("Extracting pssh boxes...");
		const showProgress = ["info", "debug"].includes(getOpts().logLevel);
		const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

		if (showProgress) {
			progress.start(downloads.getEntries().length, 0);
		}

		for (const download of downloads.getEntries()) {
			await this.processDownload(manifest, download, report);
			if (showProgress) {
				progress.increment();
			}
		}

		progress.stop();
	}

	private async processDownload(manifest: Manifest, download: DownloadEntry, report: Report): Promise<void> {
		const segmentMetadata = download.segment;

		// Skip non-video segments or segments without metadata
		if (download.representation.type !== MediaType.Video || !segmentMetadata) {
			return;
		}

		// Validate file paths exist and are accessible
		const segmentPath = path.resolve(download.destDir, download.destFile);
		const segmentInitPath = segmentMetadata.initSegmentFilesystemPath;

		if (!segmentInitPath || !(await canAccessFile(segmentPath)) || !(await canAccessFile(segmentInitPath))) {
			return;
		}

		// Read and parse PSSH data from both segments
		const initSegment = await fs.readFile(segmentInitPath);
		const segment = await fs.readFile(segmentPath);
		const psshDatas = await this.extractPsshData(initSegment, segment);

		// Validate and report content protection mismatches
		this.validateContentProtection(manifest, psshDatas, segmentMetadata, report);
	}

	private async extractPsshData(
		initSegment: Buffer,
		segment: Buffer,
	): Promise<Array<{ raw: Uint8Array; parsed: WidevineData | PlayreadyData }>> {
		const psshDatas: Array<{ raw: Uint8Array; parsed: WidevineData | PlayreadyData }> = [];
		const psshParser = new PsshParser();
		const mp4Parser = new Mp4Parser();

		// Parse PSSH from main segment
		mp4Parser
			.fullBox("pssh", (box: ParsedBox) => {
				// Grab the whole box data
				const currPos = box.reader.getPosition();

				box.reader.setPosition(box.start);
				const raw = box.reader.readBytes(box.size);
				box.reader.setPosition(currPos);

				const pssh = Mp4Parser.parsePssh(box);
				const psshData = psshParser.parseFromBox(pssh, box);
				if (psshData) {
					psshDatas.push({ raw, parsed: psshData });
				}
			})
			.box("moov", Mp4Parser.children)
			.parse(new Uint8Array(segment).buffer);

		// Parse PSSH from init segment
		mp4Parser
			.fullBox("pssh", (box: ParsedBox) => {
				// Grab the whole box data
				const currPos = box.reader.getPosition();
				box.reader.setPosition(box.start);
				const raw = box.reader.readBytes(box.size);
				box.reader.setPosition(currPos);
				const pssh = Mp4Parser.parsePssh(box);
				const psshData = psshParser.parseFromBox(pssh, box);
				if (psshData) {
					psshDatas.push({ raw, parsed: psshData });
				}
			})
			.box("moov", Mp4Parser.children)
			.parse(new Uint8Array(initSegment).buffer);

		return psshDatas;
	}

	private validateContentProtection(
		manifest: Manifest,
		psshDatas: Array<{ raw: Uint8Array; parsed: WidevineData | PlayreadyData }>,
		segmentMetadata: Segment,
		report: Report,
	): void {
		const manifestProtectionIds = segmentMetadata.contentProtectionIds;
		const psshBase64s = psshDatas.map((e) => Buffer.from(e.raw).toString("base64"));
		const manifestPsshBase64s = manifestProtectionIds
			?.map((id) => manifest.contentProtection[id]?.pssh)
			.filter((e) => e !== undefined) as Array<string>;

		// Case 1: PSSH data found in MP4 but no content protection IDs in manifest
		if (psshDatas.length && !manifestProtectionIds) {
			report.addMismatchedContentProtection({
				type: MismatchedContentProtectionType.ManifestMissing,
				detectedInMedia: psshBase64s,
				segment: segmentMetadata,
			});
			return;
		}

		// Case 2: Content protection IDs in manifest but no PSSH data found in MP4
		if (!psshDatas.length && manifestPsshBase64s?.length) {
			report.addMismatchedContentProtection({
				type: MismatchedContentProtectionType.MediaMissing,
				expectedInManifest: manifestPsshBase64s,
				segment: segmentMetadata,
			});
			return;
		}

		// Case 3: Both exist - validate each PSSH from MP4 against manifest
		psshDatas.forEach((fromMp4) => {
			const psshBase64 = Buffer.from(fromMp4.raw).toString("base64");
			const candidateFromManifest = manifest.contentProtection.find((e) => e.type === fromMp4.parsed.type);
			if (!candidateFromManifest || !candidateFromManifest.pssh) {
				report.addMismatchedContentProtection({
					type: MismatchedContentProtectionType.Mismatch,
					detectedInMedia: [{ pssh: psshBase64, parsedPssh: fromMp4.parsed }],
					segment: segmentMetadata,
				});
			} else if (candidateFromManifest.pssh !== psshBase64) {
				report.addMismatchedContentProtection({
					type: MismatchedContentProtectionType.Mismatch,
					detectedInMedia: [{ pssh: psshBase64, parsedPssh: fromMp4.parsed }],
					expectedInManifest: [
						{
							pssh: candidateFromManifest.pssh,
							parsedPssh: candidateFromManifest.parsedPssh,
						},
					],
					segment: segmentMetadata,
				});
			}
		});
	}
}
