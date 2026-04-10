import type { Descriptor } from "dash-ts";
import { CeaSchemeUri } from "../types.js";

/**
 * format: CC1=eng;CC3=swe
 * @param value
 * @returns
 */
const getCea608Info = (value: string): Array<[string, string]> => {
	const info: Array<[string, string]> = [];
	const tokens: Array<string> = value.split(";");
	for (const token of tokens) {
		const [id, lang] = token.split("=");
		if (!id || !lang) {
			continue;
		}
		info.push([id, lang.toLowerCase()]);
	}
	return info;
};

/**
 * format: 1=lang:eng;2=lang:spa
 * @param value
 * @returns
 */
const getCea708Info = (value: string): Array<[string, string]> => {
	const info: Array<[string, string]> = [];
	const tokens: Array<string> = value.split(";");

	for (const token of tokens) {
		const [id, rest] = token.split("=");
		if (!id || !rest) {
			continue;
		}
		const [, lang] = rest.split(":");
		if (!lang) {
			continue;
		}
		info.push([`svc${id}`, lang.toLowerCase()]);
	}

	return info;
};

const getStreamAndLanguages = (accessibility: Descriptor): Array<[string, string]> => {
	let streamAndLanguages: Array<[string, string]> = [];
	const { schemeIdUri, value } = accessibility;
	if (!value) {
		return [];
	}
	switch (schemeIdUri) {
		case CeaSchemeUri.CEA608:
			streamAndLanguages = getCea608Info(value);
			break;
		case CeaSchemeUri.CEA708:
			streamAndLanguages = getCea708Info(value);
			break;
	}

	return streamAndLanguages;
};

export default getStreamAndLanguages;
