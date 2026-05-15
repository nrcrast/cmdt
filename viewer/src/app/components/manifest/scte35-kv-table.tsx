"use client";

import { ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
	DESCRIPTOR_TAGS,
	formatEnumValue,
	formatPts,
	formatUpid,
	formatUpidAsHex,
	SEGMENTATION_TYPE_IDS,
	SEGMENTATION_UPID_TYPES,
	SPLICE_COMMAND_TYPES,
	toHex,
} from "./scte35-utils";

export type KVRow = {
	key: string;
	value?: React.ReactNode;
	children?: KVRow[];
	defaultOpen?: boolean;
};

function CollapsibleSection(props: { row: KVRow; depth: number }) {
	const [open, setOpen] = useState(props.row.defaultOpen ?? false);
	const { row, depth } = props;

	return (
		<>
			<TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
				<TableCell className="font-medium" style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
					<span className="inline-flex items-center gap-1">
						{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
						{row.key}
					</span>
				</TableCell>
				<TableCell className="text-muted-foreground">{row.value}</TableCell>
			</TableRow>
			{open &&
				row.children?.map((child, i) => <KVRowRenderer key={`${child.key}-${i}`} row={child} depth={depth + 1} />)}
		</>
	);
}

function KVRowRenderer(props: { row: KVRow; depth: number }) {
	const { row, depth } = props;

	if (row.children && row.children.length > 0) {
		return <CollapsibleSection row={row} depth={depth} />;
	}

	return (
		<TableRow>
			<TableCell className="font-medium" style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
				{row.key}
			</TableCell>
			<TableCell>{row.value ?? "—"}</TableCell>
		</TableRow>
	);
}

export function Scte35KVTable(props: { rows: KVRow[] }) {
	return (
		<Table className="table-fixed">
			<colgroup>
				<col className="w-[220px]" />
				<col />
			</colgroup>
			<TableBody>
				{props.rows.map((row, i) => (
					<KVRowRenderer key={`${row.key}-${i}`} row={row} depth={0} />
				))}
			</TableBody>
		</Table>
	);
}

// --- UPID cell with hex toggle ---
function UpidCell(props: { upid: Uint8Array | number[] | undefined; type: number }) {
	const [showHex, setShowHex] = useState(false);
	const { upid, type } = props;

	if (!upid) return "N/A";

	const defaultDisplay = formatUpid(upid, type);
	const hexDisplay = formatUpidAsHex(upid);
	const displayed = showHex ? hexDisplay : defaultDisplay;

	return (
		<span className="inline-flex items-center gap-2">
			<span className="font-mono text-xs break-all">{displayed}</span>
			<Button
				variant="ghost"
				size="sm"
				className="h-5 px-1 text-xs text-muted-foreground"
				onClick={(e) => {
					e.stopPropagation();
					setShowHex(!showHex);
				}}
			>
				{showHex ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
				{showHex ? "str" : "hex"}
			</Button>
		</span>
	);
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function spliceTimeToRows(spliceTime: any): KVRow[] {
	if (!spliceTime) return [];
	const rows: KVRow[] = [{ key: "Specified", value: spliceTime.specified ? "Yes" : "No" }];
	if (spliceTime.pts !== undefined) {
		rows.push({ key: "PTS", value: formatPts(spliceTime.pts) });
	}
	return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function breakDurationToRows(bd: any): KVRow[] {
	if (!bd) return [];
	return [
		{ key: "Auto Return", value: bd.autoReturn ? "Yes" : "No" },
		{ key: "Duration", value: formatPts(bd.duration) },
	];
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function spliceInsertToRows(cmd: any): KVRow[] {
	const rows: KVRow[] = [];
	if (cmd.spliceEventId !== undefined) rows.push({ key: "Splice Event ID", value: String(cmd.spliceEventId) });
	if (cmd.spliceEventCancelIndicator !== undefined)
		rows.push({ key: "Cancel Indicator", value: cmd.spliceEventCancelIndicator ? "Yes" : "No" });
	if (cmd.outOfNetworkIndicator !== undefined)
		rows.push({ key: "Out of Network", value: cmd.outOfNetworkIndicator ? "Yes (OUT)" : "No (IN)" });
	if (cmd.programSpliceFlag !== undefined)
		rows.push({ key: "Program Splice", value: cmd.programSpliceFlag ? "Yes" : "No" });
	if (cmd.spliceImmediateFlag !== undefined)
		rows.push({ key: "Immediate", value: cmd.spliceImmediateFlag ? "Yes" : "No" });
	if (cmd.durationFlag !== undefined) rows.push({ key: "Duration Flag", value: cmd.durationFlag ? "Yes" : "No" });
	if (cmd.spliceTime) rows.push({ key: "Splice Time", children: spliceTimeToRows(cmd.spliceTime), defaultOpen: true });
	if (cmd.breakDuration)
		rows.push({ key: "Break Duration", children: breakDurationToRows(cmd.breakDuration), defaultOpen: true });
	if (cmd.uniqueProgramId !== undefined) rows.push({ key: "Unique Program ID", value: String(cmd.uniqueProgramId) });
	if (cmd.available !== undefined) rows.push({ key: "Available", value: String(cmd.available) });
	if (cmd.expected !== undefined) rows.push({ key: "Expected", value: String(cmd.expected) });
	return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function timeSignalToRows(cmd: any): KVRow[] {
	const rows: KVRow[] = [{ key: "Specified", value: cmd.specified ? "Yes" : "No" }];
	if (cmd.pts !== undefined) rows.push({ key: "PTS", value: formatPts(cmd.pts) });
	return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function spliceScheduleToRows(cmd: any): KVRow[] {
	const rows: KVRow[] = [];
	if (cmd.spliceCount !== undefined) rows.push({ key: "Splice Count", value: String(cmd.spliceCount) });
	if (cmd.spliceEvents) {
		for (let i = 0; i < cmd.spliceEvents.length; i++) {
			rows.push({ key: `Event ${i + 1}`, children: spliceInsertToRows(cmd.spliceEvents[i]), defaultOpen: false });
		}
	}
	return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
function commandToRows(data: any): KVRow | null {
	if (!data?.spliceCommand && data?.spliceCommandType === 0x00) return null; // Splice Null has no command body
	if (!data?.spliceCommand) return null;

	const cmdLabel = formatEnumValue(data.spliceCommandType, SPLICE_COMMAND_TYPES);
	let children: KVRow[] = [];

	switch (data.spliceCommandType) {
		case 0x05:
			children = spliceInsertToRows(data.spliceCommand);
			break;
		case 0x06:
			children = timeSignalToRows(data.spliceCommand);
			break;
		case 0x04:
			children = spliceScheduleToRows(data.spliceCommand);
			break;
		case 0xff:
			if (data.spliceCommand.identifier !== undefined)
				children.push({ key: "Identifier", value: String(data.spliceCommand.identifier) });
			break;
		default:
			children.push({ key: "Raw", value: JSON.stringify(data.spliceCommand) });
	}

	return { key: "Command", value: cmdLabel, children, defaultOpen: true };
}

// biome-ignore lint/suspicious/noExplicitAny: descriptor types are loosely typed
function segmentationDescriptorToRows(desc: any): KVRow[] {
	const rows: KVRow[] = [];
	if (desc.segmentationEventId !== undefined) rows.push({ key: "Event ID", value: toHex(desc.segmentationEventId, 8) });
	if (desc.segmentationEventCancelIndicator !== undefined)
		rows.push({ key: "Cancel Indicator", value: desc.segmentationEventCancelIndicator ? "Yes" : "No" });
	if (desc.programSegmentationFlag !== undefined)
		rows.push({ key: "Program Segmentation", value: desc.programSegmentationFlag ? "Yes" : "No" });
	if (desc.segmentationDurationFlag !== undefined)
		rows.push({ key: "Duration Flag", value: desc.segmentationDurationFlag ? "Yes" : "No" });
	if (desc.deliveryNotRestrictedFlag !== undefined)
		rows.push({ key: "Delivery", value: desc.deliveryNotRestrictedFlag ? "Not Restricted" : "Restricted" });
	if (!desc.deliveryNotRestrictedFlag) {
		if (desc.webDeliveryAllowedFlag !== undefined)
			rows.push({ key: "Web Delivery Allowed", value: desc.webDeliveryAllowedFlag ? "Yes" : "No" });
		if (desc.noRegionalBlackoutFlag !== undefined)
			rows.push({ key: "No Regional Blackout", value: desc.noRegionalBlackoutFlag ? "Yes" : "No" });
		if (desc.archiveAllowedFlag !== undefined)
			rows.push({ key: "Archive Allowed", value: desc.archiveAllowedFlag ? "Yes" : "No" });
		if (desc.deviceRestrictions !== undefined)
			rows.push({ key: "Device Restrictions", value: toHex(desc.deviceRestrictions) });
	}
	if (desc.segmentationDuration !== undefined)
		rows.push({ key: "Duration", value: formatPts(desc.segmentationDuration) });
	if (desc.segmentationUpidType !== undefined)
		rows.push({ key: "UPID Type", value: formatEnumValue(desc.segmentationUpidType, SEGMENTATION_UPID_TYPES) });
	if (desc.segmentationUpid !== undefined)
		rows.push({ key: "UPID", value: <UpidCell upid={desc.segmentationUpid} type={desc.segmentationUpidType ?? 0} /> });
	if (desc.segmentationTypeId !== undefined)
		rows.push({ key: "Type", value: formatEnumValue(desc.segmentationTypeId, SEGMENTATION_TYPE_IDS) });
	if (desc.segmentNum !== undefined && desc.segmentsExpected !== undefined)
		rows.push({ key: "Segment", value: `${desc.segmentNum} of ${desc.segmentsExpected}` });
	if (desc.subSegmentNum !== undefined && desc.subSegmentsExpected !== undefined)
		rows.push({ key: "Sub-Segment", value: `${desc.subSegmentNum} of ${desc.subSegmentsExpected}` });
	return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: descriptor types are loosely typed
function descriptorToRows(desc: any): KVRow {
	const tag = desc.spliceDescriptorTag;
	const label = DESCRIPTOR_TAGS[tag] ?? `Unknown Descriptor (${toHex(tag)})`;
	let children: KVRow[] = [];

	if (desc.identifier) children.push({ key: "Identifier", value: desc.identifier });

	switch (tag) {
		case 0x02: // Segmentation
			children = [...children, ...segmentationDescriptorToRows(desc)];
			break;
		case 0x00: // Avail
			if (desc.providerAvailId !== undefined)
				children.push({ key: "Provider Avail ID", value: String(desc.providerAvailId) });
			break;
		case 0x01: // DTMF
			if (desc.preroll !== undefined) children.push({ key: "Preroll", value: String(desc.preroll) });
			if (desc.dtmfCount !== undefined) children.push({ key: "DTMF Count", value: String(desc.dtmfCount) });
			if (desc.dtmfChar) children.push({ key: "DTMF Chars", value: desc.dtmfChar.join(", ") });
			break;
		case 0x03: // Time
			if (desc.taiSeconds !== undefined) children.push({ key: "TAI Seconds", value: String(desc.taiSeconds) });
			if (desc.taiNs !== undefined) children.push({ key: "TAI Nanoseconds", value: String(desc.taiNs) });
			if (desc.utcOffset !== undefined) children.push({ key: "UTC Offset", value: String(desc.utcOffset) });
			break;
		default:
			children.push({ key: "Raw Data", value: JSON.stringify(desc) });
	}

	return { key: label, children, defaultOpen: true };
}

// biome-ignore lint/suspicious/noExplicitAny: descriptor types are loosely typed
function descriptorsToRow(descriptors: any[]): KVRow | null {
	if (!descriptors || descriptors.length === 0) return null;
	return {
		key: `Descriptors (${descriptors.length})`,
		children: descriptors.map((d) => descriptorToRows(d)),
		defaultOpen: true,
	};
}

// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed from scte35 lib
export function spliceInfoToRows(data: any): KVRow[] {
	if (!data) return [];
	const rows: KVRow[] = [];

	// Header fields
	if (data.tableId !== undefined) rows.push({ key: "Table ID", value: `${data.tableId} (${toHex(data.tableId)})` });
	if (data.protocolVersion !== undefined) rows.push({ key: "Protocol Version", value: String(data.protocolVersion) });
	if (data.ptsAdjustment !== undefined) rows.push({ key: "PTS Adjustment", value: formatPts(data.ptsAdjustment) });
	if (data.tier !== undefined) rows.push({ key: "Tier", value: String(data.tier) });
	if (data.encryptedPacket !== undefined) rows.push({ key: "Encrypted", value: data.encryptedPacket ? "Yes" : "No" });
	if (data.spliceCommandType !== undefined)
		rows.push({ key: "Command Type", value: formatEnumValue(data.spliceCommandType, SPLICE_COMMAND_TYPES) });

	// Command section
	const cmdRow = commandToRows(data);
	if (cmdRow) rows.push(cmdRow);

	// Descriptors section
	const descRow = descriptorsToRow(data.descriptors);
	if (descRow) rows.push(descRow);

	// CRC
	if (data.crc !== undefined) rows.push({ key: "CRC", value: toHex(data.crc, 8) });

	return rows;
}
