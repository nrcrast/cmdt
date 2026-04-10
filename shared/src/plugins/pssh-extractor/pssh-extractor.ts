import { type Manifest, MediaType, Representation, type Segment } from "../../manifest.js";
import type { PlayreadyData } from "../../drm/playready/playready.js";
import { PsshParser } from "../../drm/pssh.js";
import type { WidevineData } from "../../drm/widevine/widevine.js";
import { MismatchedContentProtectionType, type Report } from "../../report.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { ParsedBox } from "../../utils/mp4/types.js";
import { Plugin } from "../plugin.js";

export class PsshExtractor extends Plugin {
	constructor(manifest: Manifest, report: Report) {
		super(manifest, report, "pssh-extractor");
	}
	public override async processSegment(segmentMetadata: Segment, representation: Representation): Promise<void> {

		// Skip non-video segments or segments without metadata
		if (representation.type !== MediaType.Video || !segmentMetadata) {
			return;
		}

		const [initSegment, segment] = await Promise.all([segmentMetadata.initSegment?.getData(), segmentMetadata.media?.getData()]);

		if (!initSegment || !segment) {
			return;
		}

		// Read and parse PSSH data from both segments
		const psshDatas = await this.extractPsshData(initSegment, segment);

		// Validate and report content protection mismatches
		this.validateContentProtection(this.manifest, psshDatas, segmentMetadata, this.report);
	}

	private async extractPsshData(
		initSegment: ArrayBuffer,
		segment: ArrayBuffer,
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
		const psshBase64s = psshDatas.map((e) => btoa(String.fromCharCode(...new Uint8Array(e.raw))));
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
			const psshBase64 = btoa(String.fromCharCode(...new Uint8Array(fromMp4.raw)));
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
