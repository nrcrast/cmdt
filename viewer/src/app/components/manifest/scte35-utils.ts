import type { Scte35Marker } from "cmdt-shared";
import { formatTimeSeconds } from "@/lib/format";

// Splice Command Types (SCTE-35 Table 6)
export const SPLICE_COMMAND_TYPES: Record<number, string> = {
	0: "Splice Null",
	4: "Splice Schedule",
	5: "Splice Insert",
	6: "Time Signal",
	7: "Bandwidth Reservation",
	255: "Private Command",
};

// Segmentation Type IDs (SCTE-35 Table 22)
export const SEGMENTATION_TYPE_IDS: Record<number, string> = {
	0: "Not Indicated",
	1: "Content Identification",
	16: "Program Start",
	17: "Program End",
	18: "Program Early Termination",
	19: "Program Breakaway",
	20: "Program Resumption",
	21: "Program Runover Planned",
	22: "Program Runover Unplanned",
	23: "Program Overlap Start",
	24: "Program Blackout Override",
	25: "Program Start In Progress",
	32: "Chapter Start",
	33: "Chapter End",
	48: "Provider Ad Start",
	49: "Provider Ad End",
	50: "Distributor Ad Start",
	51: "Distributor Ad End",
	52: "Provider PO Start",
	53: "Provider PO End",
	54: "Distributor PO Start",
	55: "Distributor PO End",
	64: "Unscheduled Event Start",
	65: "Unscheduled Event End",
	80: "Network Start",
	81: "Network End",
};

// Segmentation UPID Types (SCTE-35 Table 21)
export const SEGMENTATION_UPID_TYPES: Record<number, string> = {
	0: "Not Used",
	1: "User Defined",
	2: "ISCI",
	3: "Ad-ID",
	4: "UMID",
	5: "ISAN (deprecated)",
	6: "V-ISAN",
	7: "TID",
	8: "TI",
	9: "ADI",
	10: "EIDR",
	11: "ATSC",
	12: "MPU",
	13: "MID",
	14: "ADS",
	15: "URI",
};

// Descriptor Tags (SCTE-35 Section 10.3)
export const DESCRIPTOR_TAGS: Record<number, string> = {
	0: "Avail Descriptor",
	1: "DTMF Descriptor",
	2: "Segmentation Descriptor",
	3: "Time Descriptor",
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

export function getMarkerSummary(marker: Scte35Marker): string {
	// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection fields are loosely typed from scte35 library
	const data = marker.data as any;
	const time = formatTimeSeconds(marker.presentationTimeS);
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
