import type { Cue } from "../../../../cue.js";
import type { Cea708ClosedCaptionByte, TextJustification } from "../../../../utils/text/types.js";
import Cea708Window from "./cea708-window.js";
import type DtvccPacket from "./dtvcc-packet.js";

// CEA-708 closed captions service as defined by CEA-708-E. A decoder can own up to 63 services. Each service owns eight windows
class Cea708Service {
	// Eight Cea708 Windows, as defined by the spec
	private _ceaWindows: Array<Cea708Window | null> = [null, null, null, null, null, null, null, null];
	private _currentCeaWindow: Cea708Window | null = null;

	// For extended control codes in block_data on CEA-708, byte 1 is 0x10
	private _EXT_CEA708_CTRL_CODE_BYTE1 = 0x10;
	private _ASCII_BACKSPACE = 0x08;
	private _ASCII_FORM_FEED = 0x0c;
	private _ASCII_CARRIAGE_RETURN = 0x0d;
	private _ASCII_HOR_CARRIAGE_RETURN = 0x0e;
	// An array of 8 colors that 64 colors can be quantized to. Order here matters
	private _COLORS: Array<string> = ["black", "blue", "green", "cyan", "red", "magenta", "yellow", "white"];
	// Holds characters mapping for bytes that are G2 control codes
	private _G2_CHARSET = new Map<number, string>([
		[0x20, " "],
		[0x21, "\xa0"],
		[0x25, "…"],
		[0x2a, "Š"],
		[0x2c, "Œ"],
		[0x30, "█"],
		[0x31, "‘"],
		[0x32, "’"],
		[0x33, "“"],
		[0x34, "”"],
		[0x35, "•"],
		[0x39, "™"],
		[0x3a, "š"],
		[0x3c, "œ"],
		[0x3d, "℠"],
		[0x3f, "Ÿ"],
		[0x76, "⅛"],
		[0x77, "⅜"],
		[0x78, "⅝"],
		[0x79, "⅞"],
		[0x7a, "│"],
		[0x7b, "┐"],
		[0x7c, "└"],
		[0x7d, "─"],
		[0x7e, "┘"],
		[0x7f, "┌"],
	]);

	// Number for this specific service (1 - 63)
	constructor(private _serviceNumber: number) {}

	// Handles G0 group data
	private handleG0(controlCode: number): void {
		if (!this._currentCeaWindow) {
			return;
		}
		// G0 contains ASCII from 0x20 to 0x7f, with the exception that 0x7f is replaced by a musical note
		if (controlCode === 0x7f) {
			this._currentCeaWindow.setCharacter("♪");

			return;
		}
		this._currentCeaWindow.setCharacter(String.fromCharCode(controlCode));
	}

	// Handles G1 group data
	private handleG1(controlCode: number): void {
		if (!this._currentCeaWindow) {
			return;
		}
		// G1 is the Latin-1 Character Set from 0xa0 to 0xff
		this._currentCeaWindow.setCharacter(String.fromCharCode(controlCode));
	}

	// Handles G2 group data
	private handleG2(controlCode: number): void {
		if (!this._currentCeaWindow) {
			return;
		}
		if (!this._G2_CHARSET.has(controlCode)) {
			// If the character is unsupported, the spec says to put an underline
			this._currentCeaWindow.setCharacter("_");

			return;
		}

		const char: string | undefined = this._G2_CHARSET.get(controlCode);
		if (char === undefined) return;
		this._currentCeaWindow.setCharacter(char);
	}

	// Handles G3 group data
	private handleG3(controlCode: number): void {
		if (!this._currentCeaWindow) {
			return;
		}

		// As of CEA-708-E, the G3 group only contains 1 character. It's a [CC] character which has no unicode value on 0xa0
		if (controlCode !== 0xa0) {
			// Similar to G2, the spec decrees an underline if char is unsupported
			this._currentCeaWindow.setCharacter("_");

			return;
		}

		this._currentCeaWindow.setCharacter("[CC]");
	}

	// Handles C0 group data.
	private handleC0(controlCode: number, pts: number): Cue | null {
		// All these commands pertain to the current ceaWindow, so ensure it exists
		if (!this._currentCeaWindow) {
			return null;
		}

		const ceaWindow: Cea708Window = this._currentCeaWindow;
		let parsedClosedCaption: Cue | null = null;

		// Note: This decoder ignores the "ETX" (end of text) control code. Since this is JavaScript, a '\0' is not needed to terminate a string
		switch (controlCode) {
			case this._ASCII_BACKSPACE:
				ceaWindow.backspace();
				break;
			case this._ASCII_CARRIAGE_RETURN:
				// Force out the buffer, since the top row could be lost
				if (ceaWindow.isVisible()) {
					parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
				}
				ceaWindow.carriageReturn();
				break;
			case this._ASCII_HOR_CARRIAGE_RETURN:
				// Force out the buffer, a row will be erased
				if (ceaWindow.isVisible()) {
					parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
				}
				ceaWindow.horizontalCarriageReturn();
				break;
			case this._ASCII_FORM_FEED:
				// Clear ceaWindow and move pen to (0,0).
				// Force emit if the ceaWindow is visible.
				if (ceaWindow.isVisible()) {
					parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
				}
				ceaWindow.resetMemory();
				ceaWindow.setPenLocation(0, 0);
				break;
		}

		return parsedClosedCaption;
	}

	// Processes C1 group data.
	// These are caption commands.
	private handleC1(dtvccPacket: DtvccPacket, captionCommand: number, pts: number): Cue | null {
		// Note: This decoder ignores delay and delayCancel control codes in the C1.
		// group. These control codes delay processing of data for a set amount of
		// time, however this decoder processes that data immediately.

		if (captionCommand >= 0x80 && captionCommand <= 0x87) {
			const windowNum: number = captionCommand & 0x07;
			this.setCurrentWindow(windowNum);
		} else if (captionCommand === 0x88) {
			const bitmap: number = dtvccPacket.readByte().value;

			return this.clearWindows(bitmap, pts);
		} else if (captionCommand === 0x89) {
			const bitmap: number = dtvccPacket.readByte().value;
			this.displayWindows(bitmap, pts);
		} else if (captionCommand === 0x8a) {
			const bitmap: number = dtvccPacket.readByte().value;

			return this.hideWindows(bitmap, pts);
		} else if (captionCommand === 0x8b) {
			const bitmap: number = dtvccPacket.readByte().value;

			return this.toggleWindows(bitmap, pts);
		} else if (captionCommand === 0x8c) {
			const bitmap: number = dtvccPacket.readByte().value;

			return this.deleteWindows(bitmap, pts);
		} else if (captionCommand === 0x8f) {
			return this.reset(pts);
		} else if (captionCommand === 0x90) {
			this.setPenAttributes(dtvccPacket);
		} else if (captionCommand === 0x91) {
			this.setPenColor(dtvccPacket);
		} else if (captionCommand === 0x92) {
			this.setPenLocation(dtvccPacket);
		} else if (captionCommand === 0x97) {
			this.setWindowAttributes(dtvccPacket);
		} else if (captionCommand >= 0x98 && captionCommand <= 0x9f) {
			const windowNum: number = (captionCommand & 0x0f) - 8;
			this.defineWindow(dtvccPacket, windowNum, pts);
		}

		return null;
	}

	// Handles C2 group data.
	private handleC2(dtvccPacket: DtvccPacket, controlCode: number): void {
		// As of the CEA-708-E spec there are no commands on the C2 table, but if
		// seen, then the appropriate number of bytes must be skipped as per spec
		if (controlCode >= 0x08 && controlCode <= 0x0f) {
			dtvccPacket.skip(1);
		} else if (controlCode >= 0x10 && controlCode <= 0x17) {
			dtvccPacket.skip(2);
		} else if (controlCode >= 0x18 && controlCode <= 0x1f) {
			dtvccPacket.skip(3);
		}
	}

	// Handles C3 group data.
	private handleC3(dtvccPacket: DtvccPacket, controlCode: number): void {
		// As of the CEA-708-E spec there are no commands on the C3 table, but if
		// seen, then the appropriate number of bytes must be skipped as per spec
		if (controlCode >= 0x80 && controlCode <= 0x87) {
			dtvccPacket.skip(4);
		} else if (controlCode >= 0x88 && controlCode <= 0x8f) {
			dtvccPacket.skip(5);
		}
	}

	private setCurrentWindow(windowNum: number): void {
		// If the ceaWindow isn't created, ignore the command
		if (!this._ceaWindows[windowNum]) {
			return;
		}
		this._currentCeaWindow = this._ceaWindows[windowNum];
	}

	// Yields each non-null ceaWindow specified in the 8-bit bitmap.
	// bitmap is 8 bits corresponding to each of the 8 windows.
	private getSpecifiedWindowIds(bitmap: number): Array<number> {
		const ids: Array<number> = [];
		for (let i = 0; i < 8; i++) {
			const windowSpecified: boolean = (bitmap & 0x01) === 0x01;
			if (windowSpecified && this._ceaWindows[i]) {
				ids.push(i);
			}
			bitmap >>= 1;
		}

		return ids;
	}

	private clearWindows(windowsBitmap: number, pts: number): Cue | null {
		let parsedClosedCaption: Cue | null = null;

		// Clears windows from the 8 bit bitmap.
		for (const windowId of this.getSpecifiedWindowIds(windowsBitmap)) {
			// If ceaWindow visible and being cleared, emit buffer and reset start time!
			const ceaWindow: Cea708Window | null = this._ceaWindows[windowId] ?? null;
			if (!ceaWindow) continue;
			if (ceaWindow.isVisible()) {
				parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
			}
			ceaWindow.resetMemory();
		}

		return parsedClosedCaption;
	}

	private displayWindows(windowsBitmap: number, pts: number): void {
		// Displays windows from the 8 bit bitmap.
		for (const windowId of this.getSpecifiedWindowIds(windowsBitmap)) {
			const ceaWindow: Cea708Window | null = this._ceaWindows[windowId] ?? null;
			if (!ceaWindow) continue;
			if (!ceaWindow.isVisible()) {
				// We are turning on the visibility, set the start time.
				ceaWindow.setStartTime(pts);
			}
			ceaWindow.display();
		}
	}

	private hideWindows(windowsBitmap: number, pts: number): Cue | null {
		let parsedClosedCaption: Cue | null = null;

		// Hides windows from the 8 bit bitmap.
		for (const windowId of this.getSpecifiedWindowIds(windowsBitmap)) {
			const ceaWindow: Cea708Window | null = this._ceaWindows[windowId] ?? null;
			if (!ceaWindow) continue;
			if (ceaWindow.isVisible()) {
				// We are turning off the visibility, emit!
				parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
			}
			ceaWindow.hide();
		}

		return parsedClosedCaption;
	}

	private toggleWindows(windowsBitmap: number, pts: number): Cue | null {
		let parsedClosedCaption: Cue | null = null;

		// Toggles windows from the 8 bit bitmap.
		for (const windowId of this.getSpecifiedWindowIds(windowsBitmap)) {
			const ceaWindow: Cea708Window | null = this._ceaWindows[windowId] ?? null;
			if (!ceaWindow) continue;
			if (ceaWindow.isVisible()) {
				// We are turning off the visibility, emit!
				parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
			} else {
				// We are turning on visibility, set the start time.
				ceaWindow.setStartTime(pts);
			}

			ceaWindow.toggle();
		}

		return parsedClosedCaption;
	}

	private deleteWindows(windowsBitmap: number, pts: number): Cue | null {
		let parsedClosedCaption: Cue | null = null;
		// Deletes windows from the 8 bit bitmap.
		for (const windowId of this.getSpecifiedWindowIds(windowsBitmap)) {
			const ceaWindow: Cea708Window | null = this._ceaWindows[windowId] ?? null;
			if (!ceaWindow) continue;
			if (ceaWindow.isVisible()) {
				// We are turning off the visibility, emit!
				parsedClosedCaption = ceaWindow.forceEmit(pts, this._serviceNumber);
			}
			// Delete the ceaWindow from the list of windows
			this._ceaWindows[windowId] = null;
		}

		return parsedClosedCaption;
	}

	private setPenAttributes(dtvccPacket: DtvccPacket): void {
		// Two bytes follow. For the purpose of this decoder, we are only concerned
		// with byte 2, which is of the form |I|U|EDTYP|FNTAG|.

		// I (1 bit): Italics toggle.
		// U (1 bit): Underline toggle.
		// EDTYP (3 bits): Edge type (unused in this decoder).
		// FNTAG (3 bits): Font tag (unused in this decoder).
		// More info at https://en.wikipedia.org/wiki/CEA-708#setPenAttributes(0x90_+_2_bytes)

		dtvccPacket.skip(1); // Skip first byte
		const attrByte2: number = dtvccPacket.readByte().value;

		if (!this._currentCeaWindow) {
			return;
		}

		const italics: boolean = (attrByte2 & 0x80) > 0;
		const underline: boolean = (attrByte2 & 0x40) > 0;

		this._currentCeaWindow.setPenItalics(italics);
		this._currentCeaWindow.setPenUnderline(underline);
	}

	private setPenColor(dtvccPacket: DtvccPacket): void {
		// Read foreground and background properties.
		const foregroundByte: number = dtvccPacket.readByte().value;
		const backgroundByte: number = dtvccPacket.readByte().value;
		dtvccPacket.skip(1); // Edge color not supported, skip it.

		if (!this._currentCeaWindow) {
			return;
		}

		// Byte semantics are described at the following link:
		// https://en.wikipedia.org/wiki/CEA-708#setPenColor(0x91_+_3_bytes)

		// Foreground color properties: |FOP|F_R|F_G|F_B|.
		const foregroundBlue: number = foregroundByte & 0x03;
		const foregroundGreen: number = (foregroundByte & 0x0c) >> 2;
		const foregroundRed: number = (foregroundByte & 0x30) >> 4;

		// Background color properties: |BOP|B_R|B_G|B_B|.
		const backgroundBlue: number = backgroundByte & 0x03;
		const backgroundGreen: number = (backgroundByte & 0x0c) >> 2;
		const backgroundRed: number = (backgroundByte & 0x30) >> 4;

		const foregroundColor: string = this.rgbColorToHex(foregroundRed, foregroundGreen, foregroundBlue);

		const backgroundColor: string = this.rgbColorToHex(backgroundRed, backgroundGreen, backgroundBlue);

		this._currentCeaWindow.setPenTextColor(foregroundColor);
		this._currentCeaWindow.setPenBackgroundColor(backgroundColor);
	}

	private setPenLocation(dtvccPacket: DtvccPacket): void {
		// Following 2 bytes take the following form:
		// b1 = |0|0|0|0|ROW| and b2 = |0|0|COLUMN|
		const locationByte1: number = dtvccPacket.readByte().value;
		const locationByte2: number = dtvccPacket.readByte().value;

		if (!this._currentCeaWindow) {
			return;
		}

		const row: number = locationByte1 & 0x0f;
		const col: number = locationByte2 & 0x3f;
		this._currentCeaWindow.setPenLocation(row, col);
	}

	private setWindowAttributes(dtvccPacket: DtvccPacket): void {
		// 4 bytes follow, with the following form:
		// Byte 1 contains fill-color information. Unused in this decoder.
		// Byte 2 contains border color information. Unused in this decoder.
		// Byte 3 contains justification information. In this decoder, we only use
		// the last 2 bits, which specifies text justification on the screen.
		// Byte 4 is special effects. Unused in this decoder.
		// More info at https://en.wikipedia.org/wiki/CEA-708#SetWindowAttributes_(0x97_+_4_bytes)
		dtvccPacket.skip(1); // Fill color not supported, skip.
		dtvccPacket.skip(1); // Border colors not supported, skip.
		const b3: number = dtvccPacket.readByte().value;
		dtvccPacket.skip(1); // Effects not supported, skip.

		if (!this._currentCeaWindow) {
			return;
		}

		// Word wrap is outdated as of CEA-708-E, so we ignore those bits.
		// Extract the text justification and set it on the ceaWindow.
		const justification: TextJustification = b3 & 0x03;
		this._currentCeaWindow.setJustification(justification);
	}

	private defineWindow(dtvccPacket: DtvccPacket, windowNum: number, pts: number): void {
		// Create the ceaWindow if it doesn't exist.
		const ceaWindowAlreadyExists: boolean = this._ceaWindows[windowNum] !== null;
		if (!ceaWindowAlreadyExists) {
			const ceaWindow: Cea708Window = new Cea708Window();
			ceaWindow.setStartTime(pts);
			this._ceaWindows[windowNum] = ceaWindow;
		}

		// 6 Bytes follow, with the following form:
		// b1 = |0|0|V|R|C|PRIOR| , b2 = |P|VERT_ANCHOR| , b3 = |HOR_ANCHOR|
		// b4 = |ANC_ID|ROW_CNT| , b5 = |0|0|COL_COUNT| , b6 = |0|0|WNSTY|PNSTY|
		// Semantics of these bytes at https://en.wikipedia.org/wiki/CEA-708#DefineWindow07_(0x98-0x9F,_+_6_bytes)
		const b1: number = dtvccPacket.readByte().value;
		const b2: number = dtvccPacket.readByte().value;
		const b3: number = dtvccPacket.readByte().value;
		const b4: number = dtvccPacket.readByte().value;
		const b5: number = dtvccPacket.readByte().value;
		const b6: number = dtvccPacket.readByte().value;

		// As per 8.4.7 of CEA-708-E, row locks and column locks are to be ignored.
		// So this decoder will ignore these values.

		const visible: boolean = (b1 & 0x20) > 0;
		const verticalAnchor: number = b2 & 0x7f;
		const horAnchor: number = b3;
		const rowCount: number = (b4 & 0x0f) + 1; // Spec says to add 1.
		const anchorId: number = (b4 & 0xf0) >> 4;
		const colCount: number = (b5 & 0x3f) + 1; // Spec says to add 1.

		// If pen style = 0 AND ceaWindow previously existed, keep its pen style.
		// Otherwise, change the pen style (For now, just reset to the default pen).
		// TODO: add support for predefined pen styles and fonts.
		const penStyle: number = b6 & 0x07;
		if (!ceaWindowAlreadyExists || penStyle !== 0) {
			this._ceaWindows[windowNum]?.resetPen();
		}

		this._ceaWindows[windowNum]?.defineWindow(visible, verticalAnchor, horAnchor, anchorId, rowCount, colCount);

		// Set the current ceaWindow to the newly defined ceaWindow.
		const currentWindow = this._ceaWindows[windowNum];
		if (currentWindow) {
			this._currentCeaWindow = currentWindow;
		}
	}

	// Maps 64 possible CEA-708 colors to 8 CSS colors.
	// red, green and blue: value from 0-3
	private rgbColorToHex(red: number, green: number, blue: number): string {
		// Rather than supporting 64 colors, this decoder supports 8 colors and
		// gets the closest color, as per 9.19 of CEA-708-E. This is because some
		// colors on television such as white, are often sent with lower intensity
		// and often appear dull/greyish on the browser, making them hard to read.

		// As per CEA-708-E 9.19, these mappings will map 64 colors to 8 colors.
		const getColorMapping = (color: number): number => {
			switch (color) {
				case 0:
				case 1:
					return 0;
				case 2:
				case 3:
					return 1;
				default:
					throw new Error(`Invalid color ${color}`);
			}
		};

		const redMapped: number = getColorMapping(red);
		const greenMapped: number = getColorMapping(green);
		const blueMapped: number = getColorMapping(blue);

		const colorCode: number = (redMapped << 2) | (greenMapped << 1) | blueMapped;

		const color = this._COLORS[colorCode];

		if (!color) {
			throw new Error(`Invalid color code ${colorCode}`);
		}

		return color;
	}

	// Emits anything currently present in any of the windows, and then
	// deletes all windows, cancels all delays, reinitializes the service
	private reset(pts: number): Cue | null {
		const allWindowsBitmap: number = 0xff; // All windows should be deleted.
		const caption: Cue | null = this.deleteWindows(allWindowsBitmap, pts);
		this.clear();

		return caption;
	}

	public clear(): void {
		this._currentCeaWindow = null;
		this._ceaWindows = [null, null, null, null, null, null, null, null];
	}

	// Processes a CEA-708 control code.
	public handleCea708ControlCode(dtvccPacket: DtvccPacket): Cue | null {
		const blockData: Cea708ClosedCaptionByte = dtvccPacket.readByte();
		let controlCode: number = blockData.value;
		const pts: number = blockData.pts;

		// Read extended control code if needed.
		if (controlCode === this._EXT_CEA708_CTRL_CODE_BYTE1) {
			const extendedControlCodeBlock: Cea708ClosedCaptionByte = dtvccPacket.readByte();
			controlCode = (controlCode << 16) | extendedControlCodeBlock.value;
		}

		// Control codes are in 1 of 4 logical groups:
		// CL (C0, C2), CR (C1, C3), GL (G0, G2), GR (G1, G2).
		if (controlCode >= 0x00 && controlCode <= 0x1f) {
			return this.handleC0(controlCode, pts);
		} else if (controlCode >= 0x80 && controlCode <= 0x9f) {
			return this.handleC1(dtvccPacket, controlCode, pts);
		} else if (controlCode >= 0x1000 && controlCode <= 0x101f) {
			this.handleC2(dtvccPacket, controlCode & 0xff);
		} else if (controlCode >= 0x1080 && controlCode <= 0x109f) {
			this.handleC3(dtvccPacket, controlCode & 0xff);
		} else if (controlCode >= 0x20 && controlCode <= 0x7f) {
			this.handleG0(controlCode);
		} else if (controlCode >= 0xa0 && controlCode <= 0xff) {
			this.handleG1(controlCode);
		} else if (controlCode >= 0x1020 && controlCode <= 0x107f) {
			this.handleG2(controlCode & 0xff);
		} else if (controlCode >= 0x10a0 && controlCode <= 0x10ff) {
			this.handleG3(controlCode & 0xff);
		}

		return null;
	}
}

export default Cea708Service;
