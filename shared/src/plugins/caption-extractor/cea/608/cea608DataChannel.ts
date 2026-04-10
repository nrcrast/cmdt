import type { Cue } from "../../../../cue.js";
import { CC_ROWS, DEFAULT_BG_COLOR, DEFAULT_TXT_COLOR } from "../../../../utils/textConstants.js";
import { CaptionType, type Cea608ClosedCaptionPacket, CharSet, CommandCode } from "../../../../utils/text/types.js";
import Cea608Memory from "./cea608Memory.js";
import { ILogObj, Logger } from "tslog";

class Cea608DataChannel {
	// Current Caption Type
	private _type: CaptionType = CaptionType.NONE;
	// Text buffer for CEA-608 "text mode". Although, we don't emit text mode.
	// So, this buffer serves as a no-op placeholder, just in case we receive
	// captions that toggle text mode
	private _text: Cea608Memory;
	// Displayed memory
	private _displayedMemory: Cea608Memory;
	// Displayed memory
	private _nonDisplayedMemory: Cea608Memory;
	// Points to current buffer
	private _curbuf: Cea608Memory;
	// End time of the previous caption, serves as start time of next caption
	private _prevEndTime = 0;
	// Last control pair, 16 bits representing byte 1 and byte 2
	private _lastCp: number | null = null;

	private _TEXT_COLORS: Array<string> = ["white", "green", "blue", "cyan", "red", "yellow", "magenta", "white_italics"];
	private _BG_COLORS: Array<string> = ["black", "green", "blue", "cyan", "red", "yellow", "magenta", "black"];
	private logger: Logger<ILogObj>;

	constructor(field: number, channel: number) {
		this._text = new Cea608Memory(field, channel);
		this._displayedMemory = new Cea608Memory(field, channel);
		this._nonDisplayedMemory = new Cea608Memory(field, channel);
		this._curbuf = this._nonDisplayedMemory;
		this.logger = new Logger<ILogObj>();
	}

	// Gets the row index from a Preamble Address Code byte pair
	private pacToRow(b1: number, b2: number): number {
		const ccrowtab: Array<number> = [
			11,
			11, // 0x00 or 0x01
			1,
			2, // 0x02 -> 0x03
			3,
			4, // 0x04 -> 0x05
			12,
			13, // 0x06 -> 0x07
			14,
			15, // 0x08 -> 0x09
			5,
			6, // 0x0A -> 0x0B
			7,
			8, // 0x0C -> 0x0D
			9,
			10, // 0x0E -> 0x0F
		];

		const rowIndex = ccrowtab[((b1 & 0x07) << 1) | ((b2 >> 5) & 0x01)];

		if (rowIndex === undefined) {
			throw new Error(`Invalid row index`);
		}

		return rowIndex;
	}

	// PAC - Preamble Address Code.
	// b1 is of the form |P|0|0|1|C|0|ROW|
	// b2 is of the form |P|1|N|ATTRIBUTE|U|
	private controlPac(b1: number, b2: number): void {
		const row: number = this.pacToRow(b1, b2);

		// Get attribute bits (4 bits)
		const attr: number = (b2 & 0x1e) >> 1;

		// Set up the defaults.
		let textColor: string = DEFAULT_TXT_COLOR;
		let italics = false;

		// Attributes < 7 are colors, = 7 is white w/ italics, and >7 are indents
		if (attr < 7) {
			textColor = this._TEXT_COLORS[attr] ?? DEFAULT_TXT_COLOR;
		} else if (attr === 7) {
			italics = true; // color stays white
		}

		// PACs toggle underline on the last bit of b2
		const underline: boolean = (b2 & 0x01) === 0x01;

		if (this._type === CaptionType.TEXT) {
			// Don't execute the PAC if in text mode
			return;
		}

		// Execute the PAC
		const buf: Cea608Memory = this._curbuf;

		// Move entire scroll window to a new base in rollup mode
		if (this._type === CaptionType.ROLLUP && row !== buf.row) {
			const oldTopRow: number = 1 + buf.row - buf.scrollSize;
			const newTopRow: number = 1 + row - buf.scrollSize;

			// Shift up the scroll window
			buf.moveRows(newTopRow, oldTopRow, buf.scrollSize);

			// Clear everything outside of the new scroll window
			buf.resetRows(0, newTopRow - 1);
			buf.resetRows(row + 1, CC_ROWS - row);
		}
		buf.setRow(row);

		buf.setUnderline(underline);
		buf.setItalics(italics);
		buf.setTextColor(textColor);

		// Clear the background color, since new row (PAC) should reset ALL styles
		buf.setBackgroundColor(DEFAULT_BG_COLOR);
	}

	// Mid-Row control code handler
	private controlMidrow(b2: number): void {
		// Clear all pre-existing midrow style attributes
		this._curbuf.setUnderline(false);
		this._curbuf.setItalics(false);
		this._curbuf.setTextColor(DEFAULT_TXT_COLOR);

		// Mid-row attrs use a space
		this._curbuf.addChar(CharSet.BASIC_NORTH_AMERICAN, " ".charCodeAt(0));

		let textColor: string | undefined = DEFAULT_TXT_COLOR;
		let italics = false;

		// Midrow codes set underline on last (LSB) bit
		const underline: boolean = (b2 & 0x01) === 0x01;

		// b2 has the form |P|0|1|0|STYLE|U|
		textColor = this._TEXT_COLORS[(b2 & 0xe) >> 1] ?? DEFAULT_TXT_COLOR;
		if (textColor === "white_italics") {
			textColor = "white";
			italics = true;
		}

		this._curbuf.setUnderline(underline);
		this._curbuf.setItalics(italics);
		this._curbuf.setTextColor(textColor);
	}

	// Background attribute control code handler
	private controlBackgroundAttribute(b1: number, b2: number): void {
		let backgroundColor: string | undefined = DEFAULT_BG_COLOR;
		if ((b1 & 0x07) === 0x0) {
			// If background provided, last 3 bits of b1 are |0|0|0|. Color is in b2
			backgroundColor = this._BG_COLORS[(b2 & 0xe) >> 1];
		}
		if (backgroundColor === undefined) {
			return;
		}
		this._curbuf.setBackgroundColor(backgroundColor);
	}

	// The Cea608DataChannel control methods implement all CC control operations
	private controlMiscellaneous(ccPacket: Cea608ClosedCaptionPacket): Cue | null {
		const b2: number = ccPacket.ccData2;
		const pts: number = ccPacket.pts;
		let parsedClosedCaption: Cue | null = null;

		switch (b2) {
			case CommandCode.RCL:
				this.controlRcl();
				break;
			case CommandCode.BS:
				this.controlBs();
				break;
			// unused (alarm off and alarm on)
			case CommandCode.AOD:
			case CommandCode.AON:
				break;
			case CommandCode.DER:
				// Delete to End of Row. Not implemented since position not supported
				break;
			case CommandCode.RU2:
				parsedClosedCaption = this.controlRu(2, pts);
				break;
			case CommandCode.RU3:
				parsedClosedCaption = this.controlRu(3, pts);
				break;
			case CommandCode.RU4:
				parsedClosedCaption = this.controlRu(4, pts);
				break;
			case CommandCode.FON:
				this.controlFon();
				break;
			case CommandCode.RDC:
				this.controlRdc(pts);
				break;
			case CommandCode.TR:
				this.controlTr();
				break;
			case CommandCode.RTD:
				this.controlRtd();
				break;
			case CommandCode.EDM:
				parsedClosedCaption = this.controlEdm(pts);
				break;
			case CommandCode.CR:
				parsedClosedCaption = this.controlCr(pts);
				break;
			case CommandCode.ENM:
				this.controlEnm();
				break;
			case CommandCode.EOC:
				parsedClosedCaption = this.controlEoc(pts);
				break;
		}

		return parsedClosedCaption;
	}

	//  Handles CR - Carriage Return (Start new row).
	//  CR only affects scroll windows (Rollup and Text modes).
	//  Any currently buffered line needs to be emitted, along
	//  with a window scroll action
	private controlCr(pts: number): Cue | null {
		const buf: Cea608Memory = this._curbuf;
		// Only rollup and text mode is affected, but we don't emit text mode
		if (this._type !== CaptionType.ROLLUP) {
			return null;
		}
		// Force out the scroll window since the top row will cleared
		const parsedClosedCaption: Cue | null = buf.forceEmit(this._prevEndTime, pts);

		// Calculate the top of the scroll window
		const toprow: number = buf.row - buf.scrollSize + 1;

		// Shift up the window one row higher
		buf.moveRows(toprow - 1, toprow, buf.scrollSize);

		// Clear out anything that's outside of our current scroll window
		buf.resetRows(0, toprow - 1);
		buf.resetRows(buf.row, CC_ROWS - buf.row);

		// Update the end time so the next caption emits starting at this time
		this._prevEndTime = pts;

		return parsedClosedCaption;
	}

	// Handles RU2, RU3, RU4 - Roll-Up, N rows.
	// If in TEXT, POPON or PAINTON, any displayed captions are erased.
	// This means must force emit entire display buffer
	private controlRu(scrollSize: number, pts: number): Cue | null {
		this._curbuf = this._displayedMemory; // Point to displayed memory
		const buf: Cea608Memory = this._curbuf;
		let parsedClosedCaption: Cue | null = null;

		// For any type except rollup and text mode, it should be emitted, and memories cleared.
		if (this._type !== CaptionType.ROLLUP && this._type !== CaptionType.TEXT) {
			parsedClosedCaption = buf.forceEmit(this._prevEndTime, pts);

			// Clear both memories
			this._displayedMemory.eraseBuffer();
			this._nonDisplayedMemory.eraseBuffer();

			// Rollup base row defaults to the last row (15)
			buf.setRow(CC_ROWS);
		}
		this._type = CaptionType.ROLLUP;

		// Set the new rollup window size
		buf.setScrollSize(scrollSize);

		return parsedClosedCaption;
	}

	// Handles flash on
	private controlFon(): void {
		this._curbuf.addChar(CharSet.BASIC_NORTH_AMERICAN, " ".charCodeAt(0));
	}

	// Handles EDM - Erase Displayed Mem
	// Mode check:
	// EDM affects all captioning modes (but not Text mode)
	private controlEdm(pts: number): Cue | null {
		const buf: Cea608Memory = this._displayedMemory;
		let parsedClosedCaption: Cue | null = null;
		if (this._type !== CaptionType.TEXT) {
			// Clearing displayed memory means we now know how long its contents were displayed, so force it out
			parsedClosedCaption = buf.forceEmit(this._prevEndTime, pts);
		}
		buf.resetAllRows();

		return parsedClosedCaption;
	}

	// Handles RDC - Resume Direct Captions. Initiates Paint-On captioning mode.
	// RDC does not affect current display, so nothing needs to be forced out yet
	private controlRdc(pts: number): void {
		this._type = CaptionType.PAINTON;
		// Point to displayed memory
		this._curbuf = this._displayedMemory;

		// No scroll window now
		this._curbuf.setScrollSize(0);

		// The next paint-on caption needs this time as the start time
		this._prevEndTime = pts;
	}

	// Handles ENM - Erase Nondisplayed Mem
	private controlEnm(): void {
		this._nonDisplayedMemory.resetAllRows();
	}

	// Handles EOC - End Of Caption (flip mem)
	// This forces Pop-On mode, and swaps the displayed and nondisplayed memories
	private controlEoc(pts: number): Cue | null {
		let parsedClosedCaption: Cue | null = null;
		if (this._type !== CaptionType.TEXT) {
			parsedClosedCaption = this._displayedMemory.forceEmit(this._prevEndTime, pts);
		}
		// Swap memories
		const buf: Cea608Memory = this._nonDisplayedMemory;
		this._nonDisplayedMemory = this._displayedMemory; // Swap buffers
		this._displayedMemory = buf;

		// Enter Pop-On mode.
		this.controlRcl();

		// The caption ended, and so the previous end time should be updated
		this._prevEndTime = pts;

		return parsedClosedCaption;
	}

	// Handles RCL - Resume Caption Loading
	// Initiates Pop-On style captioning. No need to force anything out upon
	// entering Pop-On mode because it does not affect the current display
	private controlRcl(): void {
		this._type = CaptionType.POPON;
		this._curbuf = this._nonDisplayedMemory;
		// No scroll window now
		this._curbuf.setScrollSize(0);
	}

	// Handles BS - BackSpace
	private controlBs(): void {
		this._curbuf.eraseChar();
	}

	// Handles TR - Text Restart.
	// Clears text buffer and resumes Text Mode
	private controlTr(): void {
		this._text.reset();
		this.controlRtd(); // Put into text mode
	}

	// Handles RTD - Resume Text Display.
	// Resumes text mode. No need to force anything out, because Text Mode doesn't
	// affect current display. Also, this decoder does not emit Text Mode anyway.
	private controlRtd(): void {
		this.logger.warn("CEA-608 text mode entered, but is unsupported");
		this._curbuf = this._text;
		this._type = CaptionType.TEXT;
	}

	// Handles an Extended Western European byte pair
	private handleExtendedWesternEuropeanChar(b1: number, b2: number): void {
		// Get the char set from the LSB, which is the char set toggle bit
		const charSet: CharSet = b1 & 0x01 ? CharSet.PORTUGUESE_GERMAN : CharSet.SPANISH_FRENCH;

		this._curbuf.addChar(charSet, b2);
	}

	// Checks if this is a Miscellaneous control code
	private isMiscellaneous(b1: number, b2: number): boolean {
		// For Miscellaneous Control Codes, the bytes take the following form:
		// b1 -> |0|0|0|1|C|1|0|F|
		// b2 -> |0|0|1|0|X|X|X|X|
		return (b1 & 0xf6) === 0x14 && (b2 & 0xf0) === 0x20;
	}

	// Checks if this is a PAC control code
	private isPAC(b1: number, b2: number): boolean {
		// For Preamble Address Codes, the bytes take the following form:
		// b1 -> |0|0|0|1|X|X|X|X|
		// b2 -> |0|1|X|X|X|X|X|X|
		return (b1 & 0xf0) === 0x10 && (b2 & 0xc0) === 0x40;
	}

	// Checks if this is a Midrow style change control code
	private isMidrowStyleChange(b1: number, b2: number): boolean {
		// For Midrow Control Codes, the bytes take the following form:
		// b1 -> |0|0|0|1|C|0|0|1|
		// b2 -> |0|0|1|0|X|X|X|X|
		return (b1 & 0xf7) === 0x11 && (b2 & 0xf0) === 0x20;
	}

	// Checks if this is a background attribute control code
	private isBackgroundAttribute(b1: number, b2: number): boolean {
		// For Background Attribute Codes, the bytes take the following form:
		// Bg provided: b1 -> |0|0|0|1|C|0|0|0| b2 -> |0|0|1|0|COLOR|T|
		// No Bg:       b1 -> |0|0|0|1|C|1|1|1| b2 -> |0|0|1|0|1|1|0|1|
		return ((b1 & 0xf7) === 0x10 && (b2 & 0xf0) === 0x20) || ((b1 & 0xf7) === 0x17 && (b2 & 0xff) === 0x2d);
	}

	// Checks if the character is in the Special North American char set
	private isSpecialNorthAmericanChar(b1: number, b2: number): boolean {
		// The bytes take the following form:
		// b1 -> |0|0|0|1|C|0|0|1|
		// b2 -> |0|0|1|1|  CHAR |
		return (b1 & 0xf7) === 0x11 && (b2 & 0xf0) === 0x30;
	}

	// Checks if the character is in the Extended Western European char set
	private isExtendedWesternEuropeanChar(b1: number, b2: number): boolean {
		// The bytes take the following form:
		// b1 -> |0|0|0|1|C|0|1|S|
		// b2 -> |0|0|1|CHARACTER|
		return (b1 & 0xf6) === 0x12 && (b2 & 0xe0) === 0x20;
	}

	// Set the initial PTS, which may not be 0 if we start decoding at a later
	// point in the stream.  Without this, the first cue's startTime can be way off
	public setFirstPts(firstPts: number): void {
		this._prevEndTime = firstPts;
	}

	// Handles a Basic North American byte pair
	public handleBasicNorthAmericanChar(b1: number, b2: number): void {
		this._curbuf.addChar(CharSet.BASIC_NORTH_AMERICAN, b1);
		this._curbuf.addChar(CharSet.BASIC_NORTH_AMERICAN, b2);
	}

	// Decodes control code.
	// Three types of control codes:
	// Preamble Address Codes, Mid-Row Codes, and Miscellaneous Control Codes.
	public handleControlCode(ccPacket: Cea608ClosedCaptionPacket): Cue | null {
		const b1: number = ccPacket.ccData1;
		const b2: number = ccPacket.ccData2;

		// FCC wants control codes transmitted twice, and that will often be
		// seen in broadcast captures. If the very next frame has a duplicate
		// control code, that duplicate is ignored. Note that this only applies
		// to the very next frame, and only for one match
		if (this._lastCp === ((b1 << 8) | b2)) {
			this._lastCp = null;

			return null;
		}

		// Remember valid control code for checking in next frame!
		this._lastCp = (b1 << 8) | b2;

		if (this.isPAC(b1, b2)) {
			this.controlPac(b1, b2);
		} else if (this.isMidrowStyleChange(b1, b2)) {
			this.controlMidrow(b2);
		} else if (this.isBackgroundAttribute(b1, b2)) {
			this.controlBackgroundAttribute(b1, b2);
		} else if (this.isSpecialNorthAmericanChar(b1, b2)) {
			this._curbuf.addChar(CharSet.SPECIAL_NORTH_AMERICAN, b2);
		} else if (this.isExtendedWesternEuropeanChar(b1, b2)) {
			this.handleExtendedWesternEuropeanChar(b1, b2);
		} else if (this.isMiscellaneous(b1, b2)) {
			return this.controlMiscellaneous(ccPacket);
		}

		return null;
	}

	/**
	 * Resets channel state
	 */
	public reset(): void {
		this._type = CaptionType.NONE;
		this._curbuf = this._nonDisplayedMemory;
		this._lastCp = null;
		this._displayedMemory.reset();
		this._nonDisplayedMemory.reset();
		this._text.reset();
	}
}

export default Cea608DataChannel;
