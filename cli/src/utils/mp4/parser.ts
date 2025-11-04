import createView from "../createView.js";
import hexToUint8 from "../hexToUint8.js";
import type { SchemeUri } from "../manifest/types.js";

import DataViewReader from "./dataViewReader.js";
import type {
	Elst,
	Emsg,
	Frma,
	Mdat,
	Mdhd,
	Mvhd,
	ParsedBox,
	Sidx,
	SidxReference,
	Tfdt,
	Tfhd,
	Tkhd,
	Trex,
	Trun,
} from "./types.js";
import { BoxFormat, Endian, Size } from "./types.js";

type CallbackType = (box: ParsedBox) => void;

// TODO: spike codem-isoboxer pkg
class Mp4Parser {
	private headers = new Map<string, BoxFormat>();
	private boxDefinitions = new Map<string, CallbackType>();

	private static parseData(box: ParsedBox): Uint8Array {
		const { reader } = box;
		const all: number = reader.getLength() - reader.getPosition();
		const data: Uint8Array = reader.readBytes(all);

		return data;
	}

	/**
	 * A callback that tells the Mp4 parser to treat the body of a box as a visual
	 * sample entry.  A visual sample entry has some fixed-sized fields
	 * describing the video codec parameters, followed by an arbitrary number of
	 * appended children.  Each child is a box.
	 */
	public static visualSampleEntry(box: ParsedBox): void {
		// Skip 6 reserved bytes.
		// Skip 2-byte data reference index.
		// Skip 16 more reserved bytes.
		// Skip 4 bytes for width/height.
		// Skip 8 bytes for horizontal/vertical resolution.
		// Skip 4 more reserved bytes (0)
		// Skip 2-byte frame count.
		// Skip 32-byte compressor name (length byte, then name, then 0-padding).
		// Skip 2-byte depth.
		// Skip 2 more reserved bytes (0xff)
		// 78 bytes total.
		box.reader.skip(78);

		while (box.reader.hasMoreData()) {
			box.parser.parseNext(box.reader);
		}
	}

	public static children(box: ParsedBox): void {
		while (box.reader.hasMoreData()) {
			box.parser.parseNext(box.reader);
		}
	}

	public static sampleDescription(box: ParsedBox): void {
		const count: number = box.reader.readUint32();
		for (let i = 0; i < count; i++) {
			box.parser.parseNext(box.reader);
		}
	}

	public static parseElst(box: ParsedBox): Elst {
		const { reader, version } = box;
		const entryCount: number = reader.readUint32();
		let segmentDuration = 0;
		let mediaTime = 0;
		let mediaRateInteger = 0;
		let mediaRateFraction = 0;

		if (entryCount === 1) {
			if (version === 1) {
				segmentDuration = reader.readUint64();
				mediaTime = reader.readUint64();
			} else {
				segmentDuration = reader.readUint32();
				mediaTime = reader.readUint32();
			}
			mediaRateInteger = reader.readUint16();
			mediaRateFraction = reader.readUint16();
		}

		return {
			entryCount,
			segmentDuration,
			mediaTime,
			mediaRateInteger,
			mediaRateFraction,
		};
	}

	public static parseEmsg(box: ParsedBox): Emsg {
		const { reader, version, size, start } = box;
		let id: number;
		let eventDuration: number;
		let timescale: number;
		let presentationTimeDelta: number;
		let schemeIdUri: string;
		let value: string;
		if (version === 0) {
			schemeIdUri = reader.readTerminatedString();
			value = reader.readTerminatedString();
			timescale = reader.readUint32();
			presentationTimeDelta = reader.readUint32();
			eventDuration = reader.readUint32();
			id = reader.readUint32();
		} else {
			timescale = reader.readUint32();
			presentationTimeDelta = reader.readUint64();
			eventDuration = reader.readUint32();
			id = reader.readUint32();
			schemeIdUri = reader.readTerminatedString();
			value = reader.readTerminatedString();
		}

		const messageDataSize: number = start + size - reader.getPosition();
		const messageData: Uint8Array = new Uint8Array(messageDataSize);
		messageData.set(reader.readBytes(messageDataSize));

		return {
			id,
			eventDuration,
			timescale,
			presentationTimeDelta,
			schemeIdUri,
			value,
			messageData,
		};
	}

	public static parseFrma(box: ParsedBox): Frma {
		const { reader } = box;
		const fourcc: number = reader.readUint32();
		const codec: string = reader.typeToString(fourcc);

		return { codec };
	}

	public static parseMdat(box: ParsedBox): Mdat {
		return {
			data: Mp4Parser.parseData(box),
		};
	}

	public static parseMdhd(box: ParsedBox): Mdhd {
		const { reader, version, start, size } = box;
		if (version === 1) {
			reader.skip(Size.UINT64); // Skip "creation_time"
			reader.skip(Size.UINT64); // Skip "modification_time"
		} else {
			reader.skip(Size.UINT32); // Skip "creation_time"
			reader.skip(Size.UINT32); // Skip "modification_time"
		}

		const timescale: number = reader.readUint32();

		// skip the rest
		reader.skip(start + size - reader.getPosition());

		return {
			timescale,
		};
	}

	public static parseMvhd(box: ParsedBox): Mvhd {
		const { reader, version } = box;
		if (version === 1) {
			reader.skip(Size.UINT64); // Skip "creation_time"
			reader.skip(Size.UINT64); // Skip "modification_time"
		} else {
			reader.skip(Size.UINT32); // Skip "creation_time"
			reader.skip(Size.UINT32); // Skip "modification_time"
		}

		const timescale: number = reader.readUint32();

		return {
			timescale,
		};
	}

	public static parseSidx(box: ParsedBox): Sidx {
		const { reader, version } = box;
		const referenceId: number = reader.readUint32();
		const timescale: number = reader.readUint32();

		let earliestPresentationTime: number;
		let firstOffset: number;
		if (version === 0) {
			earliestPresentationTime = reader.readUint32();
			firstOffset = reader.readUint32();
		} else {
			earliestPresentationTime = reader.readUint64();
			firstOffset = reader.readUint64();
		}

		// Skip reserved (16 bits)
		reader.skip(2);

		// Add references
		const referenceCount: number = reader.readUint16();

		const references: Array<SidxReference> = [];
		for (let i = 0; i < referenceCount; i++) {
			// |chunk| is 1 bit for |referenceType|, and 31 bits for |referenceSize|
			const chunk: number = reader.readUint32();
			const referenceType: number = (chunk & 0x80000000) >>> 31;
			const referenceSize: number = chunk & 0x7fffffff;

			const subsegmentDuration: number = reader.readUint32();

			// Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits for |sapDeltaTime|
			reader.skip(4);

			references.push({ referenceType, referenceSize, subsegmentDuration });
		}

		return {
			referenceId,
			timescale,
			earliestPresentationTime,
			firstOffset,
			references,
		};
	}

	public static parseTfdt(box: ParsedBox): Tfdt {
		const { reader, version } = box;
		const baseMediaDecodeTime: number = version === 1 ? reader.readUint64() : reader.readUint32();

		return {
			baseMediaDecodeTime,
		};
	}

	public static parseTfhd(box: ParsedBox): Tfhd {
		const { reader, flags } = box;
		let defaultSampleDuration: number | null = null;
		let defaultSampleSize: number | null = null;
		let defaultSampleFlags: number | null = null;

		const trackId: number = reader.readUint32(); // Read "track_ID"

		// Skip "base_data_offset" if present
		if (flags & 0x000001) {
			reader.skip(Size.UINT64);
		}

		// Skip "sample_description_index" if present
		if (flags & 0x000002) {
			reader.skip(Size.UINT32);
		}

		// Read "default_sample_duration" if present
		if (flags & 0x000008) {
			defaultSampleDuration = reader.readUint32();
		}

		// Read "default_sample_size" if present
		if (flags & 0x000010) {
			defaultSampleSize = reader.readUint32();
		}

		// Read "default_sample_flags" if present
		if (flags & 0x000020) {
			defaultSampleFlags = reader.readUint32();
		}

		return {
			trackId,
			defaultSampleDuration,
			defaultSampleSize,
			defaultSampleFlags,
		};
	}

	public static parseTkhd(box: ParsedBox): Tkhd {
		const { reader, version, start, size } = box;
		let trackId = 0;
		if (version === 1) {
			reader.skip(8); // Skip "creation_time"
			reader.skip(8); // Skip "modification_time"
			trackId = reader.readUint32();
		} else {
			reader.skip(4); // Skip "creation_time"
			reader.skip(4); // Skip "modification_time"
			trackId = reader.readUint32();
		}

		// skip the rest
		reader.skip(start + size - reader.getPosition());

		return {
			trackId,
		};
	}

	public static parseTrex(box: ParsedBox): Trex {
		const { reader, start, size } = box;
		reader.skip(4); // Skip "track_ID"
		reader.skip(4); // Skip "default_sample_description_index"
		const defaultSampleDuration: number = reader.readUint32();
		const defaultSampleSize: number = reader.readUint32();

		// skip the rest
		reader.skip(start + size - reader.getPosition());

		return {
			defaultSampleDuration,
			defaultSampleSize,
		};
	}

	public static parseTrun(box: ParsedBox): Trun {
		const { reader, flags, version } = box;
		const sampleCount: number = reader.readUint32();
		const sampleData: Trun["sampleData"] = [];
		let dataOffset: number | null = null;

		// Read "data_offset" if present
		if (flags & 0x000001) {
			dataOffset = reader.readUint32();
		}

		// Skip "first_sample_flags" if present
		if (flags & 0x000004) {
			reader.skip(Size.UINT32);
		}

		for (let i = 0; i < sampleCount; i++) {
			const sample: Trun["sampleData"][0] = {
				sampleDuration: null,
				sampleSize: null,
				sampleCompositionTimeOffset: null,
			};

			// Read "sample duration" if present
			if (flags & 0x000100) {
				sample.sampleDuration = reader.readUint32();
			}

			// Read "sample_size" if present
			if (flags & 0x000200) {
				sample.sampleSize = reader.readUint32();
			}

			// Skip "sample_flags" if present
			if (flags & 0x000400) {
				reader.skip(Size.UINT32);
			}

			// Read "sample_time_offset" if present
			if (flags & 0x000800) {
				sample.sampleCompositionTimeOffset = version === 0 ? reader.readUint32() : reader.readInt32();
			}

			sampleData.push(sample);
		}

		return {
			sampleCount,
			sampleData,
			dataOffset,
		};
	}

	public static updateBoxSize(reader: DataViewReader, boxStartPosition: number, boxSize: number): void {
		const offset: number = boxStartPosition;
		const sizeField: number = reader.getUint32(boxStartPosition);
		if (sizeField === 0) {
			// Means "the rest of the box"
			// No adjustment needed for this box.
		} else if (sizeField === 1) {
			// Means "use 64-bit size box"
			reader.setUint32(offset + Size.UINT64, boxSize >> 32);
			reader.setUint32(offset + Size.UINT64 + 4, boxSize & 0xffffffff);
		} else {
			// Normal 32-bit size field
			reader.setUint32(offset, boxSize);
		}
	}

	public static updateBoxType(reader: DataViewReader, boxStartPosition: number, boxType: number): void {
		const offset: number = boxStartPosition + Size.UINT32; // size
		reader.setUint32(offset, boxType); // type
	}

	public static updateElstMediaTime(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		mediaTime: number,
	): void {
		let offset: number = payloadPosition;
		offset += Size.UINT32; // entry_count
		if (version === 1) {
			offset += Size.UINT64; // segment_duration
			reader.setUint64(offset, mediaTime); // media_time
		} else {
			offset += Size.UINT32; // segment_duration
			reader.setUint32(offset, mediaTime); // media_time
		}
	}

	public static updateMehdTimescale(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		originalTimescale: number,
		timescale: number,
	): void {
		const offset: number = payloadPosition;
		if (version === 1) {
			const originalFragmentDuration: number = reader.getUint64(offset);
			// x:timescale=originalFragmentDuration:originalTimescale
			const fragmentDuration: number = Math.floor((timescale * originalFragmentDuration) / originalTimescale);
			reader.setUint64(offset, fragmentDuration); // update "fragment_duration"
		} else {
			const originalFragmentDuration: number = reader.getUint32(offset);
			// x:timescale=originalFragmentDuration:originalTimescale
			const fragmentDuration: number = Math.floor((timescale * originalFragmentDuration) / originalTimescale);
			reader.setUint32(offset, fragmentDuration); // update "fragment_duration"
		}
	}

	public static updateMdhdTimescale(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;
		if (version === 1) {
			offset += Size.UINT64; // Skip "creation_time"
			offset += Size.UINT64; // Skip "modification_time"
		} else {
			offset += Size.UINT32; // Skip "creation_time"
			offset += Size.UINT32; // Skip "modification_time"
		}

		reader.setUint32(offset, timescale);
	}

	public static updateMvhdTimescale(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;
		if (version === 1) {
			offset += Size.UINT64; // Skip "creation_time"
			offset += Size.UINT64; // Skip "modification_time"
		} else {
			offset += Size.UINT32; // Skip "creation_time"
			offset += Size.UINT32; // Skip "modification_time"
		}

		reader.setUint32(offset, timescale);
	}

	public static updateSidxTimescale(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;
		offset += Size.UINT32; // Skip "reference_ID"

		const originalTimescale: number = reader.getUint32(offset);
		reader.setUint32(offset, timescale); // update "timescale"
		offset += Size.UINT32; // Skip "timescale"

		if (version === 0) {
			const originalEarliestPresentationTime: number = reader.getUint32(offset);
			// x:timescale=originalEarliestPresentationTime:originalTimescale
			const earliestPresentationTime: number = Math.floor(
				(timescale * originalEarliestPresentationTime) / originalTimescale,
			);
			reader.setUint32(offset, earliestPresentationTime); // update "earliest_presentation_time"
			offset += Size.UINT32; // skip "earliest_presentation_time"
			offset += Size.UINT32; // skip "first_offset"
		} else {
			const originalEarliestPresentationTime: number = reader.getUint64(offset);
			// x:timescale=originalEarliestPresentationTime:originalTimescale
			const earliestPresentationTime: number = Math.floor(
				(timescale * originalEarliestPresentationTime) / originalTimescale,
			);
			reader.setUint64(offset, earliestPresentationTime); // update "earliest_presentation_time"
			offset += Size.UINT64; // skip "earliest_presentation_time"
			offset += Size.UINT64; // skip "first_offset"
		}

		// Skip reserved (16 bits)
		offset += Size.UINT16;

		// read references
		const referenceCount: number = reader.getUint16(offset);
		offset += Size.UINT16; // Skip "referenceCount"
		for (let i = 0; i < referenceCount; i++) {
			offset += Size.UINT32; // skip "referenceType" and "referenceSize"

			const originalSubsegmentDuration: number = reader.getUint32(offset);
			// x:timescale=originalSubsegmentDuration:originalTimescale
			const subsegmentDuration: number = Math.floor((timescale * originalSubsegmentDuration) / originalTimescale);
			reader.setUint32(offset, subsegmentDuration); // update "subsegment_duration"
			offset += Size.UINT32; // Skip "subsegment_duration"

			// Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits
			// for |sapDeltaTime|
			offset += Size.UINT32;
		}
	}

	public static updateTfdtTimescale(
		reader: DataViewReader,
		version: number,
		payloadPosition: number,
		originalTimescale: number,
		timescale: number,
	): void {
		const offset: number = payloadPosition;
		if (version === 0) {
			const originalBaseMediaDecodeTime: number = reader.getUint32(offset);
			// x:timescale=originalBaseMediaDecodeTime:originalTimescale
			const baseMediaDecodeTime: number = Math.floor((timescale * originalBaseMediaDecodeTime) / originalTimescale);
			reader.setUint32(offset, baseMediaDecodeTime); // update "base_media_decode_time"
		} else {
			const originalBaseMediaDecodeTime: number = reader.getUint64(offset);
			// x:timescale=originalBaseMediaDecodeTime:originalTimescale
			const baseMediaDecodeTime: number = Math.floor((timescale * originalBaseMediaDecodeTime) / originalTimescale);
			reader.setUint64(offset, baseMediaDecodeTime); // update "base_media_decode_time"
		}
	}

	public static updateTfhdTimescale(
		reader: DataViewReader,
		flags: number,
		payloadPosition: number,
		originalTimescale: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;

		offset += Size.UINT32; // Skip "track_ID"

		// Skip "base_data_offset" if present
		if (flags & 0x000001) {
			offset += Size.UINT64;
		}

		// Skip "sample_description_index" if present
		if (flags & 0x000002) {
			offset += Size.UINT32;
		}

		// update "default_sample_duration" if present
		if (flags & 0x000008) {
			const originalSampleDuration: number = reader.getUint32(offset);
			// x:timescale=originalSampleDuration:originalTimescale
			const defaultSampleDuration: number = Math.floor((timescale * originalSampleDuration) / originalTimescale);
			reader.setUint32(offset, defaultSampleDuration);
		}
	}

	public static updateTrexTimescale(
		reader: DataViewReader,
		payloadPosition: number,
		originalTimescale: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;

		offset += Size.UINT32; // Skip "track_ID"
		offset += Size.UINT32; // Skip "default_sample_description_index"

		const originalSampleDuration: number = reader.getUint32(offset);
		// x:timescale=originalSampleDuration:originalTimescale
		const defaultSampleDuration: number = Math.floor((timescale * originalSampleDuration) / originalTimescale);
		reader.setUint32(offset, defaultSampleDuration);

		offset += Size.UINT32; // Skip "default_sample_size"
	}

	public static updateTrunTimescale(
		reader: DataViewReader,
		version: number,
		flags: number,
		payloadPosition: number,
		originalTimescale: number,
		timescale: number,
	): void {
		let offset: number = payloadPosition;
		const sampleCount: number = reader.getUint32(offset);
		offset += Size.UINT32;

		// Skip "data_offset" if present
		if (flags & 0x000001) {
			offset += Size.UINT32;
		}

		// Skip "first_sample_flags" if present
		if (flags & 0x000004) {
			offset += Size.UINT32;
		}

		for (let i = 0; i < sampleCount; i++) {
			// update "sample duration" if present
			if (flags & 0x000100) {
				const originalSampleDuration: number = reader.getUint32(offset);
				// x:timescale=originalSampleDuration:originalTimescale
				const sampleDuration: number = Math.floor((timescale * originalSampleDuration) / originalTimescale);
				reader.setUint32(offset, sampleDuration);
				offset += Size.UINT32;
			}

			// Read "sample_size" if present
			if (flags & 0x000200) {
				offset += Size.UINT32;
			}

			// Skip "sample_flags" if present
			if (flags & 0x000400) {
				offset += Size.UINT32;
			}

			// Update "sample_time_offset" if present
			if (flags & 0x000800) {
				if (version === 0) {
					const originalSampleTimeOffset: number = reader.getUint32(offset);
					// x:timescale=originalSampleTimeOffset:originalTimescale
					const sampleTimeOffset: number = Math.floor((timescale * originalSampleTimeOffset) / originalTimescale);
					reader.setUint32(offset, sampleTimeOffset);
					offset += Size.UINT32;
				} else {
					const originalSampleTimeOffset: number = reader.getInt32(offset);
					// x:timescale=originalSampleTimeOffset:originalTimescale
					const sampleTimeOffset: number = Math.floor((timescale * originalSampleTimeOffset) / originalTimescale);
					reader.setInt32(offset, sampleTimeOffset);
					offset += Size.UINT32;
				}
			}
		}
	}

	public static updateSinfBoxType(sinfBox: Uint8Array, boxType: number): void {
		const sinfBoxView: DataView = createView(sinfBox, DataView) as DataView;
		// We know the offset because it's a mock
		sinfBoxView.setInt32(16, boxType);
	}

	public static updateSinfDefaultKid(sinfBox: Uint8Array, defaultKid: string): void {
		const defaultKidData: Uint8Array = hexToUint8(defaultKid);
		// We know the offset because it's a mock
		sinfBox.set(defaultKidData, sinfBox.byteLength - 16);
	}

	public static createPssh(data: Uint8Array, schemeIdUri: SchemeUri): Uint8Array {
		const systemIdStr = schemeIdUri.split(":")[2];
		if (!systemIdStr) {
			throw new Error("Invalid schemeIdUri");
		}
		const systemId: Uint8Array = hexToUint8(systemIdStr);
		const psshSize: number = 0x4 + 0x4 + 0x4 + 0x4 + systemId.length + 0x4 + data.length;
		const psshBox: Uint8Array = new Uint8Array(psshSize);
		const psshData: DataView = createView(data, DataView) as DataView;

		let byteCursor = 0;
		psshData.setUint32(byteCursor, psshSize);
		byteCursor += 0x4;
		psshData.setUint32(byteCursor, 0x70737368); // 'pssh'
		byteCursor += 0x4;
		psshData.setUint32(byteCursor, 0); // version
		byteCursor += 0x4;
		psshData.setUint32(byteCursor, 0); // flags
		byteCursor += 0x4;
		psshBox.set(systemId, byteCursor);
		byteCursor += systemId.length;
		psshData.setUint32(byteCursor, data.length);
		byteCursor += 0x4;
		psshBox.set(data, byteCursor);
		byteCursor += data.length;

		return psshBox;
	}

	public static createSinfBox(): Uint8Array {
		return new Uint8Array([
			// sinf box
			// Size: 0x50 = 80
			0x00, 0x00, 0x00, 0x50,

			// Type: sinf
			0x73, 0x69, 0x6e, 0x66,

			// Children of sinf...

			// frma box
			// Size: 0x0c = 12
			0x00, 0x00, 0x00, 0x0c,

			// Type: frma (child of sinf)
			0x66, 0x72, 0x6d, 0x61,

			// Format: filled in later based on the source box ("avc1", "mp4a", etc)
			0x00, 0x00, 0x00, 0x00,
			// end of frma box

			// schm box
			// Size: 0x14 = 20
			0x00, 0x00, 0x00, 0x14,

			// Type: schm (child of sinf)
			0x73, 0x63, 0x68, 0x6d,

			// Version: 0, Flags: 0
			0x00, 0x00, 0x00, 0x00,

			// Scheme: cenc
			0x63, 0x65, 0x6e, 0x63,

			// Scheme version: 1.0
			0x00, 0x01, 0x00, 0x00,
			// end of schm box

			// schi box
			// Size: 0x28 = 40
			0x00, 0x00, 0x00, 0x28,

			// Type: schi (child of sinf)
			0x73, 0x63, 0x68, 0x69,

			// Children of schi...

			// tenc box
			// Size: 0x20 = 32
			0x00, 0x00, 0x00, 0x20,

			// Type: tenc (child of schi)
			0x74, 0x65, 0x6e, 0x63,

			// Version: 0, Flags: 0
			0x00, 0x00, 0x00, 0x00,

			// Reserved fields
			0x00, 0x00,

			// Default protected: true
			0x01,

			// Default per-sample IV size: 8
			0x08,

			// Default key ID: all zeros (dummy)
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00,
			// end of tenc box

			// end of schi box

			// end of sinf box
		]);
	}

	private parseNext(reader: DataViewReader): void {
		const start: number = reader.getPosition();
		let size: number = reader.readUint32();
		const type: number = reader.readUint32();
		const name: string = reader.typeToString(type);

		switch (size) {
			case 0:
				size = reader.getLength() - start;
				break;
			case 1:
				size = reader.readUint64();
				break;
		}

		// Logger.getInstance().info(`Parsing box: ${name} (size: ${size})`);

		if (this.boxDefinitions.has(name)) {
			let version = 0;
			let flags = 0;

			if (this.headers.get(name) === BoxFormat.FULL_BOX) {
				const versionAndFlags: number = reader.readUint32();
				version = versionAndFlags >>> 24;
				flags = versionAndFlags & 0xffffff;
			}

			const box: ParsedBox = {
				parser: this,
				version,
				flags,
				reader,
				size,
				type,
				name,
				start,
			};

			const boxDefinition: CallbackType = this.boxDefinitions.get(name) as CallbackType;
			boxDefinition(box);
		} else {
			const skipLength: number = Math.min(
				start + size - reader.getPosition(),
				reader.getLength() - reader.getPosition(),
			);
			reader.skip(skipLength);
		}
	}

	public box(name: string, definition: CallbackType, format = BoxFormat.BASIC_BOX): Mp4Parser {
		this.headers.set(name, format);
		this.boxDefinitions.set(name, definition);

		return this;
	}

	public fullBox(name: string, definition: CallbackType): Mp4Parser {
		return this.box(name, definition, BoxFormat.FULL_BOX);
	}

	public parse(data: ArrayBuffer): void {
		const reader: DataViewReader = new DataViewReader(new Uint8Array(data), Endian.BIG);
		while (reader.hasMoreData()) {
			this.parseNext(reader);
		}
	}
}

export default Mp4Parser;
