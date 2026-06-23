import type { ColumnDef } from "@tanstack/react-table";
import type { Representation } from "cmdt-shared";

import { Badge } from "@/components/ui/badge";
import { formatBandwidth, formatTimeMs } from "@/lib/format";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

type ComparisonRow = {
	id: string;
	bandwidth: number | null;
	resolution: string;
	codecs: string;
	numSegments: number;
	durationMs: number | null;
	cea608: boolean;
	cea708: boolean;
	numChannels: number | null;
	spatialAudio: boolean;
	language: string;
	grid: string;
};

function representationDurationMs(representation: Representation): number | null {
	const last = representation.segments[representation.segments.length - 1];
	if (!last) return null;
	return last.startTime + last.duration;
}

function gridString(representation: Representation): string {
	if ("imageRows" in representation && "imageCols" in representation) {
		return `${representation.imageRows} × ${representation.imageCols}`;
	}
	return "—";
}

function toRow(representation: Representation): ComparisonRow {
	return {
		id: representation.id,
		bandwidth: representation.bandwidth ?? null,
		resolution:
			representation.width && representation.height ? `${representation.width} × ${representation.height}` : "—",
		codecs: representation.codecs ?? "—",
		numSegments: representation.segments.length,
		durationMs: representationDurationMs(representation),
		cea608: representation.hasCaptions?.cea608 ?? false,
		cea708: representation.hasCaptions?.cea708 ?? false,
		numChannels: representation.numChannels ?? null,
		spatialAudio: representation.spatialAudio ?? false,
		language: representation.language ?? "—",
		grid: gridString(representation),
	};
}

function YesNo({ value }: { value: boolean }) {
	return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>;
}

const idColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "id",
	header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
	sortingFn: "basic",
};

const bandwidthColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "bandwidth",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Bandwidth" />,
	sortingFn: "basic",
	cell: ({ row }) => formatBandwidth(row.original.bandwidth),
};

const resolutionColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "resolution",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Resolution" />,
	sortingFn: "basic",
};

const codecsColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "codecs",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Codec" />,
	sortingFn: "basic",
};

const numSegmentsColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "numSegments",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Segments" />,
	sortingFn: "basic",
};

const durationColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "durationMs",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
	sortingFn: "basic",
	cell: ({ row }) => formatTimeMs(row.original.durationMs),
};

const cea608Column: ColumnDef<ComparisonRow> = {
	accessorKey: "cea608",
	header: ({ column }) => <DataTableColumnHeader column={column} title="CEA-608" />,
	sortingFn: "basic",
	cell: ({ row }) => <YesNo value={row.original.cea608} />,
};

const cea708Column: ColumnDef<ComparisonRow> = {
	accessorKey: "cea708",
	header: ({ column }) => <DataTableColumnHeader column={column} title="CEA-708" />,
	sortingFn: "basic",
	cell: ({ row }) => <YesNo value={row.original.cea708} />,
};

const channelsColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "numChannels",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Channels" />,
	sortingFn: "basic",
	cell: ({ row }) => row.original.numChannels ?? "—",
};

const spatialAudioColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "spatialAudio",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Spatial Audio" />,
	sortingFn: "basic",
	cell: ({ row }) => <YesNo value={row.original.spatialAudio} />,
};

const languageColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "language",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Language" />,
	sortingFn: "basic",
};

const gridColumn: ColumnDef<ComparisonRow> = {
	accessorKey: "grid",
	header: ({ column }) => <DataTableColumnHeader column={column} title="Grid" />,
	sortingFn: "basic",
};

const videoColumns: ColumnDef<ComparisonRow>[] = [
	idColumn,
	bandwidthColumn,
	resolutionColumn,
	codecsColumn,
	cea608Column,
	cea708Column,
	numSegmentsColumn,
	durationColumn,
];

const audioColumns: ColumnDef<ComparisonRow>[] = [
	idColumn,
	bandwidthColumn,
	codecsColumn,
	channelsColumn,
	spatialAudioColumn,
	languageColumn,
	numSegmentsColumn,
	durationColumn,
];

const textColumns: ColumnDef<ComparisonRow>[] = [
	idColumn,
	languageColumn,
	codecsColumn,
	numSegmentsColumn,
	durationColumn,
];

const imageColumns: ColumnDef<ComparisonRow>[] = [
	idColumn,
	bandwidthColumn,
	resolutionColumn,
	gridColumn,
	numSegmentsColumn,
	durationColumn,
];

const columnsByVariant: Record<string, ColumnDef<ComparisonRow>[]> = {
	video: videoColumns,
	audio: audioColumns,
	text: textColumns,
	image: imageColumns,
};

export default function RepresentationComparison(props: {
	representations: Array<Representation>;
	variant: "video" | "audio" | "text" | "image";
}) {
	const rows = props.representations.map(toRow);
	return <DataTable columns={columnsByVariant[props.variant]} data={rows} />;
}
