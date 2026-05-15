import type { Scte35Marker } from "cmdt-shared";

// Splice Command Types (SCTE-35 Table 6)
export const SPLICE_COMMAND_TYPES: Record<number, string> = {
	0x00: "Splice Null",
	0x04: "Splice Schedule",
	0x05: "Splice Insert",
	0x06: "Time Signal",
	0x07: "Bandwidth Reservation",
	0xff: "Private Command",
};

// Segmentation Type IDs (SCTE-35 Table 22)
export const SEGMENTATION_TYPE_IDS: Record<number, string> = {
	0x00: "Not Indicated",
	0x01: "Content Identification",
	0x10: "Program Start",
	0x11: "Program End",
	0x12: "Program Early Termination",
	0x13: "Program Breakaway",
	0x14: "Program Resumption",
	0x15: "Program Runover Planned",
	0x16: "Program Runover Unplanned",
	0x17: "Program Overlap Start",
	0x18: "Program Blackout Override",
	0x19: "Program Start In Progress",
	0x20: "Chapter Start",
	0x21: "Chapter End",
	0x30: "Provider Ad Start",
	0x31: "Provider Ad End",
	0x32: "Distributor Ad Start",
	0x33: "Distributor Ad End",
	0x34: "Provider PO Start",
	0x35: "Provider PO End",
	0x36: "Distributor PO Start",
	0x37: "Distributor PO End",
	0x40: "Unscheduled Event Start",
	0x41: "Unscheduled Event End",
	0x50: "Network Start",
	0x51: "Network End",
};

// Segmentation UPID Types (SCTE-35 Table 21)
export const SEGMENTATION_UPID_TYPES: Record<number, string> = {
	0x00: "Not Used",
	0x01: "User Defined",
	0x02: "ISCI",
	0x03: "Ad-ID",
	0x04: "UMID",
	0x05: "ISAN (deprecated)",
	0x06: "V-ISAN",
	0x07: "TID",
	0x08: "TI",
	0x09: "ADI",
	0x0a: "EIDR",
	0x0b: "ATSC",
	0x0c: "MPU",
	0x0d: "MID",
	0x0e: "ADS",
	0x0f: "URI",
};

// Descriptor Tags (SCTE-35 Section 10.3)
export const DESCRIPTOR_TAGS: Record<number, string> = {
	0x00: "Avail Descriptor",
	0x01: "DTMF Descriptor",
	0x02: "Segmentation Descriptor",
	0x03: "Time Descriptor",
};

// String-renderable UPID types (decoded as UTF-8)
const STRING_UPID_TYPES = new Set([0x01, 0x02, 0x03, 0x09, 0x0e, 0x0f]);
// Integer UPID types
const INTEGER_UPID_TYPES = new Set([0x08]);

export function toHex(value: number, pad = 2): string {
	return `0x${value.toString(16).padStart(pad, "0").toUpperCase()}`;
}

export function formatEnumValue(value: number | undefined, map: Record<number, string>, pad = 2): string {
	if (value === undefined || value === null) return "N/A";
	const label = map[value];
	return label ? `${label} (${toHex(value, pad)})` : `Unknown (${toHex(value, pad)})`;
}

export function ptsToSeconds(pts: number): string {
	return `${(pts / 90000).toFixed(3)}s`;
}

export function formatPts(pts: number | undefined): string {
	if (pts === undefined || pts === null) return "N/A";
	return `${pts} (${ptsToSeconds(pts)})`;
}

export function formatUpidAsHex(upid: Uint8Array | number[] | undefined): string {
	if (!upid) return "N/A";
	const bytes = Array.from(upid);
	return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function formatUpid(upid: Uint8Array | number[] | undefined, type: number): string {
	if (!upid || (Array.isArray(upid) && upid.length === 0)) return "N/A";
	const bytes = Array.from(upid);

	if (STRING_UPID_TYPES.has(type)) {
		try {
			return new TextDecoder().decode(new Uint8Array(bytes));
		} catch {
			return formatUpidAsHex(upid);
		}
	}

	if (INTEGER_UPID_TYPES.has(type)) {
		let value = 0;
		for (const byte of bytes) {
			value = value * 256 + byte;
		}
		return value.toString();
	}

	return formatUpidAsHex(upid);
}

export function isStringUpidType(type: number): boolean {
	return STRING_UPID_TYPES.has(type);
}

export function isIntegerUpidType(type: number): boolean {
	return INTEGER_UPID_TYPES.has(type);
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection fields are loosely typed from scte35 library
export function getMarkerSummary(marker: Scte35Marker): string {
	const data = marker.data as any;
	const time = `${marker.presentationTimeS.toFixed(3)}s`;
	const cmdType = SPLICE_COMMAND_TYPES[data?.spliceCommandType ?? -1] ?? "Unknown";

	let detail = "";
	if (data?.spliceCommandType === 0x05 && data?.spliceCommand) {
		// Splice Insert
		const cmd = data.spliceCommand;
		if (cmd.outOfNetworkIndicator !== undefined) {
			detail = cmd.outOfNetworkIndicator ? "OUT" : "IN";
		}
		if (cmd.breakDuration?.duration !== undefined) {
			detail += `${detail ? ", " : ""}Break: ${ptsToSeconds(cmd.breakDuration.duration)}`;
		}
	} else if (data?.spliceCommandType === 0x06 && data?.spliceCommand) {
		// Time Signal
		const cmd = data.spliceCommand;
		if (cmd.pts !== undefined) {
			detail = `PTS: ${cmd.pts}`;
		}
	}

	const descCount = data?.descriptors?.length ?? 0;
	const descLabel = descCount === 1 ? "1 descriptor" : `${descCount} descriptors`;

	const parts = [time, cmdType];
	if (detail) parts.push(detail);
	parts.push(descLabel);

	return parts.join(" · ");
}

export function getCommandTypeSummary(markers: Array<Scte35Marker>): string {
	const counts: Record<string, number> = {};
	for (const marker of markers) {
		// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection fields are loosely typed
		const data = marker.data as any;
		const label = SPLICE_COMMAND_TYPES[data?.spliceCommandType ?? -1] ?? "Unknown";
		counts[label] = (counts[label] ?? 0) + 1;
	}
	const parts = Object.entries(counts)
		.sort(([, a], [, b]) => b - a)
		.map(([label, count]) => `${count} ${label}`);
	return `${markers.length} marker${markers.length === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

export function getUniqueCommandTypes(markers: Array<Scte35Marker>): number[] {
	const types = new Set<number>();
	for (const marker of markers) {
		// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection fields are loosely typed
		const data = marker.data as any;
		if (data?.spliceCommandType !== undefined) {
			types.add(data.spliceCommandType);
		}
	}
	return Array.from(types).sort((a, b) => a - b);
}

export function getUniqueSegmentationTypes(markers: Array<Scte35Marker>): number[] {
	const types = new Set<number>();
	for (const marker of markers) {
		// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection fields are loosely typed
		const data = marker.data as any;
		for (const desc of data?.descriptors ?? []) {
			if (desc.segmentationTypeId !== undefined) {
				types.add(desc.segmentationTypeId);
			}
		}
	}
	return Array.from(types).sort((a, b) => a - b);
}
