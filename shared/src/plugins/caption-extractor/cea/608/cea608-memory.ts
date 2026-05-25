import type { Cue } from "../../../../cue.js";
import getParsedCaption from "../../../../utils/cea/get-parsed-caption.js";
import { CharSet, type StyledChar } from "../../../../utils/text/types.js";
import { CC_ROWS, DEFAULT_BG_COLOR, DEFAULT_TXT_COLOR } from "../../../../utils/text-constants.js";

class Cea608Memory {
	// Buffer for storing decoded characters
	private _rows: Array<Array<StyledChar>> = [];
	// Current row
	private _row = -1;
	// Number of rows in the scroll window. Used for rollup mode
	private _scrollRows = 0;
	private _underline = false;
	private _italics = false;
	private _textColor: string = DEFAULT_TXT_COLOR;
	private _backgroundColor: string = DEFAULT_BG_COLOR;

	// Basic North American char set deviates from ASCII with these exceptions
	private _BASIC_NORTH_AMERICAN_CHARS = new Map<number, string>([
		[0x27, "’"],
		[0x2a, "á"],
		[0x5c, "é"],
		[0x5c, "é"],
		[0x5e, "í"],
		[0x5f, "ó"],
		[0x60, "ú"],
		[0x7b, "ç"],
		[0x7c, "÷"],
		[0x7d, "Ñ"],
		[0x7e, "ñ"],
		[0x7f, "█"],
	]);
	// Special North American char set.
	// Note: Transparent Space is currently implemented as a regular space.
	private _SPECIAL_NORTH_AMERICAN_CHARS = new Map<number, string>([
		[0x30, "®"],
		[0x31, "°"],
		[0x32, "½"],
		[0x33, "¿"],
		[0x34, "™"],
		[0x35, "¢"],
		[0x36, "£"],
		[0x37, "♪"],
		[0x38, "à"],
		[0x39, "⠀"],
		[0x3a, "è"],
		[0x3b, "â"],
		[0x3c, "ê"],
		[0x3d, "î"],
		[0x3e, "ô"],
		[0x3f, "û"],
	]);
	// Extended Spanish/Misc/French char set.
	private _EXTENDED_SPANISH_FRENCH = new Map<number, string>([
		[0x20, "Á"],
		[0x21, "É"],
		[0x22, "Ó"],
		[0x23, "Ú"],
		[0x24, "Ü"],
		[0x25, "ü"],
		[0x26, "‘"],
		[0x27, "¡"],
		[0x28, "*"],
		[0x29, "'"],
		[0x2a, "─"],
		[0x2b, "©"],
		[0x2c, "℠"],
		[0x2d, "·"],
		[0x2e, "“"],
		[0x2f, "”"],
		[0x30, "À"],
		[0x31, "Â"],
		[0x32, "Ç"],
		[0x33, "È"],
		[0x34, "Ê"],
		[0x35, "Ë"],
		[0x36, "ë"],
		[0x37, "Î"],
		[0x38, "Ï"],
		[0x39, "ï"],
		[0x3a, "Ô"],
		[0x3b, "Ù"],
		[0x3c, "ù"],
		[0x3d, "Û"],
		[0x3e, "«"],
		[0x3f, "»"],
	]);
	// Extended Portuguese/German/Danish char set.
	private _EXTENDED_PORTUGUESE_GERMAN = new Map<number, string>([
		[0x20, "Ã"],
		[0x21, "ã"],
		[0x22, "Í"],
		[0x23, "Ì"],
		[0x24, "ì"],
		[0x25, "Ò"],
		[0x26, "ò"],
		[0x27, "Õ"],
		[0x28, "õ"],
		[0x29, "{"],
		[0x2a, "}"],
		[0x2b, "\\"],
		[0x2c, "^"],
		[0x2d, "_"],
		[0x2e, "|"],
		[0x2f, "~"],
		[0x30, "Ä"],
		[0x31, "ä"],
		[0x32, "Ö"],
		[0x33, "ö"],
		[0x34, "ß"],
		[0x35, "¥"],
		[0x36, "¤"],
		[0x37, "│"],
		[0x38, "Å"],
		[0x39, "å"],
		[0x3a, "Ø"],
		[0x3b, "ø"],
		[0x3c, "┌"],
		[0x3d, "┐"],
		[0x3e, "└"],
		[0x3f, "┘"],
	]);

	private _ROW_TO_LINE_CONVERSION = new Map([
		[1, 10],
		[2, 15.33],
		[3, 20.66],
		[4, 26],
		[5, 31.33],
		[6, 36.66],
		[7, 42],
		[8, 47.33],
		[9, 52.66],
		[10, 58],
		[11, 63.33],
		[12, 68.66],
		[13, 74],
		[14, 79.33],
		[15, 84.66],
	]);

	constructor(
		private _field: number,
		private _channel: number,
	) {
		this.reset();
	}

	public get row(): number {
		return this._row;
	}

	public get scrollSize(): number {
		return this._scrollRows;
	}

	public setRow(row: number): void {
		this._row = row;
	}

	public setScrollSize(scrollSize: number): void {
		this._scrollRows = scrollSize;
	}

	public setUnderline(underline: boolean): void {
		this._underline = underline;
	}

	public setItalics(italics: boolean): void {
		this._italics = italics;
	}

	public setTextColor(textColor: string): void {
		this._textColor = textColor;
	}

	public setBackgroundColor(backgroundColor: string): void {
		this._backgroundColor = backgroundColor;
	}

	// Emits a closed caption based on the state of the buffer.
	public forceEmit(startTime: number, endTime: number): Cue | null {
		const stream: string = `CC${(this._field << 1) | (this._channel + 1)}`;
		const line: number = this._ROW_TO_LINE_CONVERSION.get(this._row) ?? 0;

		const emptyCue: Cue = {
			id: `${startTime}_${endTime}_${stream}`,
			begin: startTime,
			end: endTime,
			position: line,
			texts: [],
			rawText: "",
			lang: "",
			region: null,
			offset: 0,
		};

		return getParsedCaption(emptyCue, this._rows);
	}

	// Resets the memory buffer
	public reset(): void {
		this.resetAllRows();
		this._row = 1;
	}

	// Adds a character to the buffer.
	public addChar(set: CharSet, b: number): void {
		// Valid chars are in the range [0x20, 0x7f]
		if (b < 0x20 || b > 0x7f) {
			return;
		}

		let char: string | undefined = "";
		switch (set) {
			case CharSet.BASIC_NORTH_AMERICAN:
				if (this._BASIC_NORTH_AMERICAN_CHARS.has(b)) {
					char = this._BASIC_NORTH_AMERICAN_CHARS.get(b);
				} else {
					// Regular ASCII
					char = String.fromCharCode(b);
				}
				break;
			case CharSet.SPECIAL_NORTH_AMERICAN:
				char = this._SPECIAL_NORTH_AMERICAN_CHARS.get(b);
				break;
			case CharSet.SPANISH_FRENCH:
				// Extended charset does a BS over preceding char, 6.4.2 EIA-608-B.
				this.eraseChar();
				char = this._EXTENDED_SPANISH_FRENCH.get(b);
				break;
			case CharSet.PORTUGUESE_GERMAN:
				this.eraseChar();
				char = this._EXTENDED_PORTUGUESE_GERMAN.get(b);
				break;
		}

		if (char) {
			const styledChar: StyledChar = {
				character: char,
				underline: this._underline,
				italics: this._italics,
				backgroundColor: this._backgroundColor,
				textColor: this._textColor,
			};
			this._rows[this._row]?.push(styledChar);
		}
	}

	// Erases a character from the buffer.
	public eraseChar(): void {
		this._rows[this._row]?.pop();
	}

	// Moves rows of characters.
	public moveRows(dst: number, src: number, count: number): void {
		if (src < 0 || dst < 0) {
			return;
		}

		if (dst >= src) {
			for (let i: number = count - 1; i >= 0; i--) {
				const srcBytes = this._rows[src + i];
				if (!srcBytes) {
					continue;
				}
				this._rows[dst + i] = srcBytes.map((e: StyledChar) => e);
			}
		} else {
			for (let i = 0; i < count; i++) {
				const srcBytes = this._rows[src + i];
				if (!srcBytes) {
					continue;
				}
				this._rows[dst + i] = srcBytes.map((e: StyledChar) => e);
			}
		}
	}

	// Resets rows of characters.
	public resetRows(idx: number, count: number): void {
		for (let i = 0; i <= count; i++) {
			this._rows[idx + i] = [];
		}
	}

	// Resets the entire memory buffer.
	public resetAllRows(): void {
		this.resetRows(0, CC_ROWS);
	}

	// Erases entire memory buffer.
	// Doesn't change scroll state or number of rows.
	public eraseBuffer(): void {
		this._row = this._scrollRows > 0 ? this._scrollRows : 0;
		this.resetAllRows();
	}
}

export default Cea608Memory;
