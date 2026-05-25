import type { ManifestParser } from "../manifest.js";
import { DashManifest } from "./dash/dash.js";
import { HlsManifest } from "./hls/hls.js";

export function getManifestParser(manifestUri: string): ManifestParser {
	return manifestUri.toLocaleLowerCase().includes(".mpd") ? new DashManifest() : new HlsManifest();
}
