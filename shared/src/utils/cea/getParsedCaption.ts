import type { Cue, Style, Text } from "../../cue.js";
import buildRawText from "../buildRawText.js";
import type { StyledChar } from "../text/types.js";

import { DEFAULT_BG_COLOR, DEFAULT_TXT_COLOR } from "../textConstants.js";

const createTextCue = (underline: boolean, italics: boolean, txtColor: string, bgColor: string): Text => {
	const style: Style = {};
	if (underline) {
		style.textDecoration = "underline";
	}
	if (italics) {
		style.fontStyle = "italic";
	}
	style.color = txtColor;
	style.backgroundColor = bgColor;

	return {
		text: "",
		style,
	};
};

const getParsedCaption = (cue: Cue, memory: Array<Array<StyledChar | null>>): Cue | null => {
	if (cue.begin >= cue.end) {
		return null;
	}

	// Find the first and last row that contains characters
	let firstNonEmptyRow = -1;
	let lastNonEmptyRow = -1;

	for (let i = 0; i < memory.length; i++) {
		if (memory[i]?.some((e: StyledChar | null) => e !== null && e.character.trim() !== "")) {
			firstNonEmptyRow = i;
			break;
		}
	}

	for (let i: number = memory.length - 1; i >= 0; i--) {
		if (memory[i]?.some((e: StyledChar | null) => e !== null && e.character.trim() !== "")) {
			lastNonEmptyRow = i;
			break;
		}
	}

	// Exit early if no non-empty row was found
	if (firstNonEmptyRow === -1 || lastNonEmptyRow === -1) {
		return null;
	}

	// Keeps track of the current styles for a cue being emitted
	let currentUnderline = false;
	let currentItalics = false;
	let currentTextColor: string = DEFAULT_TXT_COLOR;
	let currentBackgroundColor: string = DEFAULT_BG_COLOR;

	for (let i: number = firstNonEmptyRow; i <= lastNonEmptyRow; i++) {
		// Create first text cue. Default styles
		let currentText: Text = createTextCue(currentUnderline, currentItalics, currentTextColor, currentBackgroundColor);

		// Find the first and last non-empty characters in this row. We do this so
		// no styles creep in before/after the first and last non-empty chars
		const row: Array<StyledChar | null> = memory[i] ?? [];
		let firstNonEmptyCol = -1;
		let lastNonEmptyCol = -1;

		for (let j = 0; j < row.length; j++) {
			if (row[j] !== null && row[j]?.character.trim() !== "") {
				firstNonEmptyCol = j;
				break;
			}
		}

		for (let j: number = row.length - 1; j >= 0; j--) {
			if (row[j] !== null && row[j]?.character.trim() !== "") {
				lastNonEmptyCol = j;
				break;
			}
		}

		// If no non-empty char. was found in this row, it must be a linebreak
		if (firstNonEmptyCol === -1 || lastNonEmptyCol === -1) {
			continue;
		}

		for (let j: number = firstNonEmptyCol; j <= lastNonEmptyCol; j++) {
			const styledChar: StyledChar | null = row[j] ?? null;

			// A null between non-empty cells in a row is handled as a space
			if (!styledChar) {
				currentText.text += " ";
				continue;
			}
			const underline: boolean = styledChar.underline;
			const italics: boolean = styledChar.italics;
			const textColor: string = styledChar.textColor;
			const backgroundColor: string = styledChar.backgroundColor;

			// If any style properties have changed, we need to open a new cue
			if (
				underline !== currentUnderline ||
				italics !== currentItalics ||
				textColor !== currentTextColor ||
				backgroundColor !== currentBackgroundColor
			) {
				// Push the currently built cue and start a new cue, with new styles
				if (currentText.text) {
					cue.texts.push(currentText);
				}
				currentText = createTextCue(underline, italics, textColor, backgroundColor);

				currentUnderline = underline;
				currentItalics = italics;
				currentTextColor = textColor;
				currentBackgroundColor = backgroundColor;
			}

			currentText.text += styledChar.character;
		}
		if (currentText.text) {
			cue.texts.push(currentText);
		}
	}

	if (cue.texts.length > 0) {
		cue.rawText = buildRawText(cue.texts);

		return cue;
	}

	return null;
};

export default getParsedCaption;
