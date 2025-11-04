import type { Cue } from "cmdt-shared";
import type winston from "winston";
import { getInstance as getLogger } from "../../logger.js";
import type { CeaSchemeUri, DataSegment } from "../../utils/manifest/types.js";
import Mp4Parser from "../../utils/mp4/parser.js";
import type { Frma, Mdhd, ParsedBox, Tfdt, Tfhd, Tkhd, Trex, Trun } from "../../utils/mp4/types.js";
import { BitstreamFormat } from "../types.js";
import CeaDecoder from "./ceaDecoder.js";

type CeaSegment = DataSegment & { periodId: string };

class CeaParser {
	private _ceaDecoder: CeaDecoder;
	private logger: winston.Logger;

	private _defaultSampleDuration = 0;
	private _defaultSampleSize = 0;
	private _trackIdToTimescale = new Map<number, number>();
	private _bitstreamFormat: BitstreamFormat = BitstreamFormat.UNKNOWN;

	private _CODEC_BITSTREAM_MAP: Record<string, BitstreamFormat> = {
		avc1: BitstreamFormat.H264,
		avc3: BitstreamFormat.H264,
		hev1: BitstreamFormat.H265,
		hvc1: BitstreamFormat.H265,
		// Dolby vision is also H265.
		dvh1: BitstreamFormat.H265,
		dvhe: BitstreamFormat.H265,
	};

	private _DEFAULT_TIMESCALE = 90000;
	private _H264_NALU_TYPE_SEI = 0x06;
	private _H265_PREFIX_NALU_TYPE_SEI = 0x27;
	private _H265_SUFFIX_NALU_TYPE_SEI = 0x28;

	private _parsedIdsMap: Map<string, Set<number>> = new Map();
	private _currentPeriodId: string | null = null;

	constructor() {
		this._ceaDecoder = new CeaDecoder();
		this.logger = getLogger();
	}

	private parseInit(data: ArrayBuffer): void {
		const trackIds: Array<number> = [];
		const timescales: Array<number> = [];

		const skipToEnd = (box: ParsedBox): void => {
			const { reader } = box;
			const end: number = box.start + box.size - reader.getPosition();
			reader.skip(end);
		};

		const codecBoxParser = (box: ParsedBox): void => {
			this.setBitstreamFormat(box.name);
			skipToEnd(box);
		};

		new Mp4Parser()
			.box("moov", Mp4Parser.children)
			.box("mvex", Mp4Parser.children)
			.fullBox("trex", (box: ParsedBox) => {
				const parsedTrexBox: Trex = Mp4Parser.parseTrex(box);
				this._defaultSampleDuration = parsedTrexBox.defaultSampleDuration;
				this._defaultSampleSize = parsedTrexBox.defaultSampleSize;
			})
			.box("trak", Mp4Parser.children)
			.fullBox("tkhd", (box: ParsedBox) => {
				const parsedTkhdBox: Tkhd = Mp4Parser.parseTkhd(box);
				trackIds.push(parsedTkhdBox.trackId);
			})
			.box("mdia", Mp4Parser.children)
			.fullBox("mdhd", (box: ParsedBox) => {
				const parsedMdhdBox: Mdhd = Mp4Parser.parseMdhd(box);
				timescales.push(parsedMdhdBox.timescale);
			})
			.box("minf", Mp4Parser.children)
			.box("stbl", Mp4Parser.children)
			.fullBox("stsd", Mp4Parser.sampleDescription)

			// These are the various boxes that signal a codec.
			.box("avc1", codecBoxParser)
			.box("avc3", codecBoxParser)
			.box("hev1", codecBoxParser)
			.box("hvc1", codecBoxParser)
			.box("dvav", codecBoxParser)
			.box("dva1", codecBoxParser)
			.box("dvh1", codecBoxParser)
			.box("dvhe", codecBoxParser)

			// This signals an encrypted sample, which we can go inside of to find
			// the codec used.
			.box("encv", Mp4Parser.visualSampleEntry)
			.box("sinf", Mp4Parser.children)
			.box("frma", (box: ParsedBox) => {
				const parsedFrmaBox: Frma = Mp4Parser.parseFrma(box);
				this.setBitstreamFormat(parsedFrmaBox.codec);
			})
			.parse(data);

		if (this._bitstreamFormat === BitstreamFormat.UNKNOWN) {
			const message: string = "Unable to determine bitstream format for CEA parsing";
			this.logger.warn(message);
		}

		// Populate the map from track Id to timescale
		trackIds.forEach((trackId: number, idx: number) => {
			if (!timescales[idx]) {
				this.logger.error(`No timescale for track ${trackId} at index ${idx}`);
				return;
			}
			this._trackIdToTimescale.set(trackId, timescales[idx]);
		});
	}

	private process(naluData: Uint8Array): Array<Uint8Array> {
		const seiPayloads: Array<Uint8Array> = [];
		const naluClone: Uint8Array = this.removeEmu(naluData);

		// The following is an implementation of section 7.3.2.3.1
		// in Rec. ITU-T H.264 (06/2019), the H.264 spec.
		let offset = 0;

		while (offset < naluClone.length) {
			let payloadType = 0; // SEI payload type as defined by H.264 spec
			while (naluClone[offset] === 0xff) {
				payloadType += 255;
				offset++;
			}
			// biome-ignore lint/style/noNonNullAssertion: This is here for readability, and we know that offset is in bounds.
			payloadType += naluClone[offset++]!;

			let payloadSize = 0; // SEI payload size as defined by H.264 spec
			while (naluClone[offset] === 0xff) {
				payloadSize += 255;
				offset++;
			}
			// biome-ignore lint/style/noNonNullAssertion: This is here for readability, and we know that offset is in bounds.
			payloadSize += naluClone[offset++]!;

			// Payload type 4 is user_data_registered_itu_t_t35, as per the H.264
			// spec. This payload type contains caption data.
			if (payloadType === 0x04) {
				seiPayloads.push(naluClone.subarray(offset, offset + payloadSize));
			}
			offset += payloadSize;
		}

		return seiPayloads;
	}

	private removeEmu(naluData: Uint8Array): Uint8Array {
		let naluClone: Uint8Array = naluData;
		let zeroCount = 0;
		let src = 0;
		while (src < naluClone.length) {
			if (zeroCount === 2 && naluClone[src] === 0x03) {
				// 0x00, 0x00, 0x03 pattern detected
				zeroCount = 0;

				const newArr: Array<number> = Array.from(naluClone);
				newArr.splice(src, 1);
				naluClone = new Uint8Array(newArr);
			} else {
				if (naluClone[src] === 0x00) {
					zeroCount++;
				} else {
					zeroCount = 0;
				}
			}
			src++;
		}

		return naluClone;
	}

	private setBitstreamFormat(codec: string): void {
		const bitstreamFormat: BitstreamFormat | undefined = this._CODEC_BITSTREAM_MAP[codec];
		if (bitstreamFormat) {
			this._bitstreamFormat = bitstreamFormat;
		}
	}

	public clear(): void {
		this._currentPeriodId = null;
		this._parsedIdsMap.clear();
		this._ceaDecoder.clear();
	}

	public parse(segment: CeaSegment, ceaSchemeIdUri: CeaSchemeUri): Array<Cue> {
		const periodId: string = segment.periodId;
		const isNewPeriod: boolean = this._currentPeriodId !== periodId;
		this._currentPeriodId = periodId;
		let parsedSegmentSet: Set<number> | undefined = this._parsedIdsMap.get(periodId);
		if (parsedSegmentSet?.has(segment.id)) return [];
		if (!parsedSegmentSet) {
			parsedSegmentSet = new Set();
			this._parsedIdsMap.set(periodId, parsedSegmentSet);
		}
		parsedSegmentSet.add(segment.id);

		const data: ArrayBuffer = segment.data as ArrayBuffer;
		const captionPackets: Array<{ pts: number; packet: Uint8Array }> = [];

		if (segment.id === 0) {
			if (isNewPeriod) {
				this._ceaDecoder.clear();
			}
			this.parseInit(data);

			return [];
		}

		if (this._bitstreamFormat === BitstreamFormat.UNKNOWN) {
			// We don't know how to extract SEI from this.
			return [];
		}

		// Fields that are found in MOOF boxes
		let defaultSampleDuration: number = this._defaultSampleDuration;
		let defaultSampleSize: number = this._defaultSampleSize;
		let moofOffset = 0;
		const parsedTRUNs: Array<Trun> = [];
		let baseMediaDecodeTime = 0;
		let timescale: number = this._DEFAULT_TIMESCALE;

		new Mp4Parser()
			.box("moof", (box: ParsedBox) => {
				moofOffset = box.start;
				// trun box parsing is reset on each moof.
				parsedTRUNs.length = 0;
				Mp4Parser.children(box);
			})
			.box("traf", Mp4Parser.children)
			.fullBox("trun", (box: ParsedBox) => {
				const parsedTrunBox: Trun = Mp4Parser.parseTrun(box);
				parsedTRUNs.push(parsedTrunBox);
			})
			.fullBox("tfhd", (box: ParsedBox) => {
				const parsedTfhdBox: Tfhd = Mp4Parser.parseTfhd(box);
				defaultSampleDuration = parsedTfhdBox.defaultSampleDuration || this._defaultSampleDuration;
				defaultSampleSize = parsedTfhdBox.defaultSampleSize || this._defaultSampleSize;
				const trackTimescale: number | undefined = this._trackIdToTimescale.get(parsedTfhdBox.trackId);
				if (trackTimescale !== undefined) {
					timescale = trackTimescale;
				}
			})
			.fullBox("tfdt", (box: ParsedBox) => {
				const parsedTfdtBox: Tfdt = Mp4Parser.parseTfdt(box);
				baseMediaDecodeTime = parsedTfdtBox.baseMediaDecodeTime;
			})
			.box("mdat", (box: ParsedBox) => {
				const { reader } = box;

				let sampleIndex = 0;
				let sampleSize: number = defaultSampleSize;

				// Combine all sample data.  This assumes that the samples described across
				// multiple trun boxes are still continuous in the mdat box.
				const sampleData: Trun["sampleData"] = [];
				parsedTRUNs.forEach((t: Trun) => {
					sampleData.push(...t.sampleData);
				});

				if (sampleData.length) {
					sampleSize = sampleData[0]?.sampleSize || defaultSampleSize;
				}

				const parsedTrunOffset: number = parsedTRUNs[0]?.dataOffset || 0;
				const offset: number = moofOffset + parsedTrunOffset - box.start - 8;

				reader.skip(offset);

				while (reader.hasMoreData()) {
					const naluSize: number = reader.readUint32();
					const naluHeader: number = reader.readUint8();
					let naluType: number | null = null;
					let isSeiMessage = false;
					let naluHeaderSize = 1;

					switch (this._bitstreamFormat) {
						case BitstreamFormat.H264:
							naluType = naluHeader & 0x1f;
							isSeiMessage = naluType === this._H264_NALU_TYPE_SEI;
							break;

						case BitstreamFormat.H265:
							naluHeaderSize = 2;
							reader.skip(1);
							naluType = (naluHeader >> 1) & 0x3f;
							isSeiMessage =
								naluType === this._H265_PREFIX_NALU_TYPE_SEI || naluType === this._H265_SUFFIX_NALU_TYPE_SEI;
							break;

						default:
							return;
					}

					if (isSeiMessage) {
						let timeOffset = 0;

						if (sampleIndex < sampleData.length) {
							// biome-ignore lint/style/noNonNullAssertion: We know that sampleIndex is in bounds here.
							timeOffset = sampleData[sampleIndex]!.sampleCompositionTimeOffset || 0;
						}

						const pts: number = (baseMediaDecodeTime + timeOffset) / timescale;

						for (const packet of this.process(reader.readBytes(naluSize - naluHeaderSize))) {
							captionPackets.push({
								packet,
								pts,
							});
						}
					} else {
						try {
							reader.skip(naluSize - naluHeaderSize);
							// biome-ignore lint/correctness/noUnusedVariables: We don't care about the error here.
						} catch (e) {
							// It is necessary to ignore this error because it can break the start
							// of playback even if the user does not want to see the subtitles.
							break;
						}
					}
					sampleSize -= naluSize + 4;
					if (sampleSize === 0) {
						if (sampleIndex < sampleData.length) {
							// biome-ignore lint/style/noNonNullAssertion: We know that sampleIndex is in bounds here.
							baseMediaDecodeTime += sampleData[sampleIndex]!.sampleDuration || defaultSampleDuration;
						} else {
							baseMediaDecodeTime += defaultSampleDuration;
						}

						sampleIndex++;

						if (sampleIndex < sampleData.length) {
							// biome-ignore lint/style/noNonNullAssertion: We know that sampleIndex is in bounds here.
							sampleSize = sampleData[sampleIndex]!.sampleSize || defaultSampleSize;
						} else {
							sampleSize = defaultSampleSize;
						}
					}
				}
			})
			.parse(data);

		for (const captionPacket of captionPackets) {
			if (captionPacket.packet.length > 0) {
				this._ceaDecoder.extract(captionPacket.packet, captionPacket.pts, ceaSchemeIdUri);
			}
		}

		return this._ceaDecoder.decode();
	}

	public destroy(): void {
		this._parsedIdsMap.clear();

		this.clear();
	}
}

export default CeaParser;
