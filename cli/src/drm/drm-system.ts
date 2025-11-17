import type { Pssh } from "../utils/mp4/types.js";

export abstract class DrmParser<T> {
	public static readonly systemId: string;
	constructor(protected psshBox: Pssh) {}

	public abstract parse(): T;
}
