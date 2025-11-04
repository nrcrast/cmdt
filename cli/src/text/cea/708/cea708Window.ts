import type { Cue, Region } from "cmdt-shared";
import getParsedCaption from "../../../utils/cea/getParsedCaption.js";
import createEmptyRegion from "../../../utils/createEmptyRegion.js";
import {
	DEFAULT_BG_COLOR,
	DEFAULT_TXT_COLOR,
	LINE_HEIGHT_MULTIPLIER,
	LINE_WIDTH_MULTIPLIER_16_9,
} from "../../../utils/textConstants.js";
import { AnchorId, type StyledChar, TextJustification } from "../../types.js";

// CEA-708 Window. Each CEA-708 service owns 8 of these.
class Cea708Window {
	// Indicates whether this window is visible
	private _visible = false;
	// Horizontal anchor. Loosely corresponds to a WebVTT viewport X anchor
	private _horizontalAnchor = 0;
	// Vertical anchor. Loosely corresponds to a WebVTT viewport Y anchor
	private _verticalAnchor = 0;
	/**
	 * If valid, ranges from 0 to 8, specifying one of 9 locations on window:
	 * 0________1________2
	 * |        |        |
	 * 3________4________5
	 * |        |        |
	 * 6________7________8
	 * Diagram is valid as per CEA-708-E section 8.4.4.
	 * Each of these locations corresponds to a WebVTT region's "region anchor".
	 */
	private _anchorId = 0;
	// Indicates the number of rows in this window's buffer/memory
	private _rowCount = 0;
	// Indicates the number of columns in this window's buffer/memory
	private _colCount = 0;
	// Center by default
	private _justification: TextJustification = TextJustification.CENTER;
	// An array of rows of styled characters, representing the current text and styling of text in this window
	private _memory: Array<Array<StyledChar | null>> = [];
	private _startTime = 0;
	// Row that the current pen is pointing at
	private _row = 0;
	// Column that the current pen is pointing at
	private _col = 0;
	// Indicates whether the current pen position is italicized
	private _italics = false;
	// Indicates whether the current pen position is underlined
	private _underline = false;
	// Indicates the text color at the current pen position
	private _textColor: string = DEFAULT_TXT_COLOR;
	// Indicates the background color at the current pen position
	private _backgroundColor: string = DEFAULT_BG_COLOR;

	// Maximum of 16 rows that can be indexed from 0 to 15
	private _MAX_ROWS = 16;
	// Can be indexed 0-31 for 4:3 format, and 0-41 for 16:9 formats.
	// Thus the absolute maximum is 42 columns for the 16:9 format.
	private _MAX_COLS = 42;

	// windowNum: A number from 0 - 7 indicating the window number in the service that owns this window.
	// parentService: A number for the parent service (1 - 63).
	constructor() {
		this.resetMemory();
	}

	/**
	 * Support window positioning by mapping anchor related values to CueRegion.
	 * https://dvcs.w3.org/hg/text-tracks/raw-file/default/608toVTT/608toVTT.html#positioning-in-cea-708
	 * @param {Region} region
	 * @private
	 */
	private adjustRegion(region: Region): void {
		region.height = this._rowCount * LINE_HEIGHT_MULTIPLIER;
		region.width = this._colCount * LINE_WIDTH_MULTIPLIER_16_9;

		region.viewportanchorX = this._horizontalAnchor;
		region.viewportanchorY = this._verticalAnchor;

		// WebVTT's region viewport anchors are technically always in percentages.
		// However, we don't know the aspect ratio of the video at this point,
		// which determines how we interpret the horizontal anchor.
		// So, we expose the additonal flag to reflect whether these viewport anchor
		// values can be used be used as is or should be converted to percentages.

		switch (this._anchorId) {
			case AnchorId.UPPER_LEFT:
				region.regionAnchorX = 0;
				region.regionAnchorY = 0;
				break;
			case AnchorId.UPPER_CENTER:
				region.regionAnchorX = 50;
				region.regionAnchorY = 0;
				break;
			case AnchorId.UPPER_RIGHT:
				region.regionAnchorX = 100;
				region.regionAnchorY = 0;
				break;
			case AnchorId.MIDDLE_LEFT:
				region.regionAnchorX = 0;
				region.regionAnchorY = 50;
				break;
			case AnchorId.MIDDLE_CENTER:
				region.regionAnchorX = 50;
				region.regionAnchorY = 50;
				break;
			case AnchorId.MIDDLE_RIGHT:
				region.regionAnchorX = 100;
				region.regionAnchorY = 50;
				break;
			case AnchorId.LOWER_LEFT:
				region.regionAnchorX = 0;
				region.regionAnchorY = 100;
				break;
			case AnchorId.LOWER_CENTER:
				region.regionAnchorX = 50;
				region.regionAnchorY = 100;
				break;
			case AnchorId.LOWER_RIGHT:
				region.regionAnchorX = 100;
				region.regionAnchorY = 100;
				break;
		}
	}

	// Allocates and returns a new row.
	private createNewRow(): Array<StyledChar | null> {
		const row: Array<StyledChar | null> = [];
		for (let j = 0; j < this._MAX_COLS; j++) {
			row.push(null);
		}

		return row;
	}

	private isPenInBounds(): boolean {
		const inRowBounds: boolean = this._row < this._rowCount && this._row >= 0;
		const inColBounds: boolean = this._col < this._colCount && this._col >= 0;

		return inRowBounds && inColBounds;
	}

	// Moves up <count> rows in the buffer
	private moveUpRows(count: number): void {
		let dst = 0; // Row each row should be moved to.

		// Move existing rows up by <count>.
		for (let i: number = count; i < this._MAX_ROWS; i++, dst++) {
			// biome-ignore lint/style/noNonNullAssertion: The bounds are known at this point, this is for readability
			this._memory[dst] = this._memory[i]!;
		}

		// Create <count> new rows at the bottom.
		for (let i = 0; i < count; i++, dst++) {
			this._memory[dst] = this.createNewRow();
		}
	}

	public setPenLocation(row: number, col: number): void {
		this._row = row;
		this._col = col;
	}

	public setPenBackgroundColor(backgroundColor: string): void {
		this._backgroundColor = backgroundColor;
	}

	public setPenTextColor(textColor: string): void {
		this._textColor = textColor;
	}

	public setPenUnderline(underline: boolean): void {
		this._underline = underline;
	}

	public setPenItalics(italics: boolean): void {
		this._italics = italics;
	}

	public setJustification(justification: TextJustification): void {
		this._justification = justification;
	}

	public setStartTime(pts: number): void {
		this._startTime = pts;
	}

	// Erases a character from the buffer and moves the pen back
	public backspace(): void {
		if (!this.isPenInBounds()) {
			return;
		}

		// Check if a backspace can be done.
		if (this._col <= 0 && this._row <= 0) {
			return;
		}

		if (this._col <= 0) {
			// Move pen back a row.
			this._col = this._colCount - 1;
			this._row--;
		} else {
			// Move pen back a column.
			this._col--;
		}

		// Erase the character occupied at that position.
		// biome-ignore lint/style/noNonNullAssertion: The bounds are known at this point, this is for readability
		this._memory[this._row]![this._col] = null;
	}

	public defineWindow(
		visible: boolean,
		verticalAnchor: number,
		horizontalAnchor: number,
		anchorId: number,
		rowCount: number,
		colCount: number,
	): void {
		this._visible = visible;
		this._verticalAnchor = verticalAnchor;
		this._horizontalAnchor = horizontalAnchor;
		this._anchorId = anchorId;
		this._rowCount = rowCount;
		this._colCount = colCount;
	}

	public isVisible(): boolean {
		return this._visible;
	}

	// Resets the memory buffer
	public resetMemory(): void {
		this._memory = [];
		for (let i = 0; i < this._MAX_ROWS; i++) {
			this._memory.push(this.createNewRow());
		}
	}

	// Sets the unicode value for a char at the current pen location
	public setCharacter(char: string): void {
		// Check if the pen is out of bounds.
		if (!this.isPenInBounds()) {
			return;
		}

		const cea708Char: StyledChar = {
			character: char,
			underline: this._underline,
			italics: this._italics,
			backgroundColor: this._backgroundColor,
			textColor: this._textColor,
		};
		// biome-ignore lint/style/noNonNullAssertion: The bounds are known at this point, this is for readability
		this._memory[this._row]![this._col] = cea708Char;

		// Increment column
		this._col++;
	}

	// Handles CR. Increments row - if last row, "roll up" all rows by one.
	public carriageReturn(): void {
		if (this._row + 1 >= this._rowCount) {
			this.moveUpRows(1);
			this._col = 0;

			return;
		}

		this._row++;
		this._col = 0;
	}

	// Handles HCR. Moves the pen to the beginning of the cur. row and clears it
	public horizontalCarriageReturn(): void {
		this._memory[this._row] = this.createNewRow();
		this._col = 0;
	}

	public forceEmit(endTime: number, serviceNumber: number): Cue | null {
		const stream: string = `svc${serviceNumber}`;

		const emptyCue: Cue = {
			id: `${this._startTime}_${endTime}_${stream}`,
			begin: this._startTime,
			end: endTime,
			position: 0,
			texts: [],
			rawText: "",
			lang: "",
			region: null,
			offset: 0,
		};

		const region: Region = createEmptyRegion();
		if (this._justification === TextJustification.LEFT) {
			// LEFT justified.
			region.align = "left";
		} else if (this._justification === TextJustification.RIGHT) {
			// RIGHT justified.
			region.align = "right";
		} else {
			// CENTER justified. Both FULL and CENTER are handled as CENTER justified.
			region.align = "center";
		}

		this.adjustRegion(region);

		emptyCue.region = region;

		const caption: Cue | null = getParsedCaption(emptyCue, this._memory);
		if (caption) {
			// If a caption is being emitted, then the next caption's start time
			// should be no less than this caption's end time.
			this.setStartTime(endTime);
		}

		return caption;
	}

	// Reset the pen to 0,0 with default styling
	public resetPen(): void {
		this._row = 0;
		this._col = 0;
		this._underline = false;
		this._italics = false;
		this._textColor = DEFAULT_TXT_COLOR;
		this._backgroundColor = DEFAULT_BG_COLOR;
	}

	// Sets the window to visible
	public display(): void {
		this._visible = true;
	}

	// Sets the window to invisible
	public hide(): void {
		this._visible = false;
	}

	// Toggles the visibility of the window
	public toggle(): void {
		this._visible = !this._visible;
	}
}

export default Cea708Window;
