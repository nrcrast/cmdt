import { DrmSystem } from "cmdt-shared";
import { PlayreadyParser } from "../drm/playready/playready.js";
import { WidevineParser } from "../drm/widevine/widevine.js";

export function getDrmSystemFromSystemId(systemId: string): DrmSystem {
	let cleanedSystemId = systemId;
	if (systemId.startsWith("urn:uuid:")) {
		cleanedSystemId = systemId.slice(9);
	}
	switch (cleanedSystemId) {
		case WidevineParser.systemId:
			return DrmSystem.WIDEVINE;
		case PlayreadyParser.systemId:
			return DrmSystem.PLAYREADY;
		default:
			return DrmSystem.UNKNOWN;
	}
}
