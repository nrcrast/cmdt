import type { ParsedBox, Pssh } from "../utils/mp4/types.js";

export type PsshBox = {
	version: ParsedBox["version"];
	flags: ParsedBox["flags"];
	size: ParsedBox["size"];
	keyIds?: Array<string>;
};
export abstract class DrmParser<T> {
	public static readonly systemId: string;
	constructor(
		protected psshBox: Pssh,
		protected box?: ParsedBox,
	) {}

	public abstract parse(): T;
}
