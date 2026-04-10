// Main text enums
export enum BitstreamFormat {
	UNKNOWN = "unknown",
	H264 = "h264",
	H265 = "h265",
}

// CEA enums
export enum CcType {
	NTSC_CC_FIELD_1 = 0,
	NTSC_CC_FIELD_2 = 1,
	DTVCC_PACKET_DATA = 2,
	DTVCC_PACKET_START = 3,
}

// CEA-608 enums
export enum CaptionType {
	NONE = 0,
	POPON = 1,
	PAINTON = 2,
	ROLLUP = 3,
	TEXT = 4,
}

export enum CharSet {
	BASIC_NORTH_AMERICAN = 0,
	SPECIAL_NORTH_AMERICAN = 1,
	SPANISH_FRENCH = 2,
	PORTUGUESE_GERMAN = 3,
}

export enum CommandCode {
	// "RCL - Resume Caption Loading"
	RCL = 0x20,
	// "BS  - BackSpace"
	BS = 0x21,
	// "AOD - Unused (alarm off)"
	AOD = 0x22,
	// "AON - Unused (alarm on)"
	AON = 0x23,
	// "DER - Delete to End of Row"
	DER = 0x24,
	// "RU2 - Roll-Up, 2 rows"
	RU2 = 0x25,
	// "RU3 - Roll-Up, 3 rows"
	RU3 = 0x26,
	// "RU4 - Roll-Up, 4 rows"
	RU4 = 0x27,
	// "FON - Flash On"
	FON = 0x28,
	// "RDC - Resume Direct Captions"
	RDC = 0x29,
	// "TR - Text Restart"
	TR = 0x2a,
	// "RTD - Resume Text Display"
	RTD = 0x2b,
	// "EDM - Erase Displayed Mem"
	EDM = 0x2c,
	// "CR  - Carriage return"
	CR = 0x2d,
	// "ENM - Erase Nondisplayed Mem"
	ENM = 0x2e,
	// "EOC - End Of Caption (flip mem)"
	EOC = 0x2f,
}

// CEA-708 enums
export enum AnchorId {
	UPPER_LEFT = 0,
	UPPER_CENTER = 1,
	UPPER_RIGHT = 2,
	MIDDLE_LEFT = 3,
	MIDDLE_CENTER = 4,
	MIDDLE_RIGHT = 5,
	LOWER_LEFT = 6,
	LOWER_CENTER = 7,
	LOWER_RIGHT = 8,
}

export enum TextJustification {
	LEFT = 0,
	RIGHT = 1,
	CENTER = 2,
	FULL = 3,
}

// Types
export type StyledChar = {
	character: string;
	underline: boolean;
	italics: boolean;
	backgroundColor: string;
	textColor: string;
};

export type Cea608ClosedCaptionPacket = {
	// Presentation timestamp (in second) at which this packet was received.
	pts: number;
	// Type of the packet. Either 0 or 1, representing the CEA-608 field.
	type: number;
	// CEA-608 byte 1
	ccData1: number;
	// CEA-608 byte 2
	ccData2: number;
	// A number indicating the order this packet was received in a sequence
	// of packets. Used to break ties in a stable sorting algorithm
	order: number;
};

export type Cea708ClosedCaptionByte = {
	// Presentation timestamp (in second) at which this packet was received
	pts: number;
	// Type of the byte. Either 2 or 3, DTVCC Packet Data or a DTVCC Packet Start
	type: number;
	// The byte containing data relevant to the packet
	value: number;
	// A number indicating the order this packet was received in a sequence
	// of packets. Used to break ties in a stable sorting algorithm
	order: number;
};
