import type DataViewReader from "./dataViewReader.js";
import type Mp4Parser from "./parser.js";

// Enums
export enum BoxFormat {
	BASIC_BOX = "BASIC_BOX",
	FULL_BOX = "FULL_BOX",
}

export enum Endian {
	BIG = "BIG",
	LITTLE = "LITTLE",
}

export enum Size {
	NUL_BYTE = 1,
	UINT8 = 1,
	UINT16 = 2,
	UINT32 = 4,
	UINT64 = 8,
}

export type Pssh = {
	systemId: string;
	kids?: Array<string>;
	data: Uint8Array;
};

export type Emsg = {
	id: number;
	eventDuration: number;
	timescale: number;
	presentationTimeDelta?: number;
	presentationTime?: number;
	schemeIdUri: string;
	value: string;
	messageData: Uint8Array | string;
};

export type Elst = {
	entryCount: number;
	segmentDuration: number;
	mediaTime: number;
	mediaRateInteger: number;
	mediaRateFraction: number;
};

export type Frma = {
	codec: string;
};

export type Mdat = {
	data: Uint8Array;
};

export type Mdhd = {
	timescale: number;
};

export type Mvhd = {
	timescale: number;
};

export type ParsedBox = {
	parser: Mp4Parser;
	version: number;
	flags: number;
	reader: DataViewReader;
	size: number;
	type: number;
	name: string;
	start: number;
};

export type SidxReference = {
	referenceType: number;
	referenceSize: number;
	subsegmentDuration: number;
};

export type Sidx = {
	referenceId: number;
	timescale: number;
	earliestPresentationTime: number;
	firstOffset: number;
	references: Array<SidxReference>;
};

export type Tfdt = {
	baseMediaDecodeTime: number;
};

export type Tfhd = {
	trackId: number;
	defaultSampleDuration: number | null;
	defaultSampleSize: number | null;
	defaultSampleFlags: number | null;
};

export type Tkhd = {
	trackId: number;
};

export type Trex = {
	defaultSampleDuration: number;
	defaultSampleSize: number;
};

export type Trun = {
	sampleCount: number;
	sampleData: Array<{
		sampleDuration: number | null;
		sampleSize: number | null;
		sampleCompositionTimeOffset: number | null;
	}>;
	dataOffset: number | null;
};
