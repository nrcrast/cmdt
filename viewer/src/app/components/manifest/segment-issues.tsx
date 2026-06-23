"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { RawReport as Report } from "cmdt-shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimeMs } from "@/lib/format";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { SegmentTable } from "./segment-table";

type GapRow = {
	mediaType: string;
	representation: string;
	expectedStartTime: number;
	startTime: number;
	gap: number;
};

const gapColumns: ColumnDef<GapRow>[] = [
	{
		accessorKey: "mediaType",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Media Type" />,
		enableHiding: true,
	},
	{
		accessorKey: "representation",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Representation" />,
		enableHiding: true,
	},
	{
		accessorKey: "expectedStartTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Expected Start" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTimeMs(row.original.expectedStartTime),
	},
	{
		accessorKey: "startTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Actual Start" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTimeMs(row.original.startTime),
	},
	{
		accessorKey: "gap",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Gap" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTimeMs(row.original.gap),
	},
];

const gapDefaultVisibleColumns = {
	mediaType: true,
	representation: true,
	expectedStartTime: true,
	startTime: true,
	gap: true,
};

const decodeTimeVisibleColumns = {
	startTime: true,
	rawSegmentTime: true,
	baseMediaDecodeTime: true,
	duration: false,
	contentProtection: false,
};

const durationVisibleColumns = {
	startTime: true,
	duration: true,
	mediaDuration: true,
	contentProtection: false,
};

function flattenGaps(gaps: Report["gaps"]): GapRow[] {
	const rows: GapRow[] = [];
	for (const [mediaType, reps] of Object.entries(gaps)) {
		for (const [representation, entries] of Object.entries(reps)) {
			for (const entry of entries) {
				rows.push({
					mediaType,
					representation,
					expectedStartTime: entry.expectedStartTime,
					startTime: entry.segment.startTime,
					gap: entry.segment.startTime - entry.expectedStartTime,
				});
			}
		}
	}
	return rows;
}

export default function SegmentIssues({ report }: { report: Report }) {
	const gapRows = flattenGaps(report.gaps);
	const decodeTimeMismatches = report.decodeTimeMismatches;
	const durationMismatches = report.durationMismatches;

	if (!gapRows.length && !decodeTimeMismatches.length && !durationMismatches.length) {
		return (
			<Alert>
				<AlertTitle>No Segment Issues</AlertTitle>
				<AlertDescription>
					No gaps, decode time mismatches, or duration mismatches were found in this report.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Tabs defaultValue="gaps">
			<TabsList>
				<TabsTrigger value="gaps">Gaps ({gapRows.length})</TabsTrigger>
				<TabsTrigger value="decode-time">Decode Time Mismatches ({decodeTimeMismatches.length})</TabsTrigger>
				<TabsTrigger value="duration">Duration Mismatches ({durationMismatches.length})</TabsTrigger>
			</TabsList>
			<TabsContent value="gaps">
				{gapRows.length ? (
					<DataTable columns={gapColumns} data={gapRows} defaultVisibleColumns={gapDefaultVisibleColumns} />
				) : (
					<Alert>
						<AlertTitle>No Gaps</AlertTitle>
						<AlertDescription>No segment gaps were detected in this report.</AlertDescription>
					</Alert>
				)}
			</TabsContent>
			<TabsContent value="decode-time">
				{decodeTimeMismatches.length ? (
					<SegmentTable
						manifest={report.manifest}
						segments={decodeTimeMismatches}
						defaultVisibleColumns={decodeTimeVisibleColumns}
					/>
				) : (
					<Alert>
						<AlertTitle>No Decode Time Mismatches</AlertTitle>
						<AlertDescription>No decode time mismatches were detected in this report.</AlertDescription>
					</Alert>
				)}
			</TabsContent>
			<TabsContent value="duration">
				{durationMismatches.length ? (
					<SegmentTable
						manifest={report.manifest}
						segments={durationMismatches}
						defaultVisibleColumns={durationVisibleColumns}
					/>
				) : (
					<Alert>
						<AlertTitle>No Duration Mismatches</AlertTitle>
						<AlertDescription>No duration mismatches were detected in this report.</AlertDescription>
					</Alert>
				)}
			</TabsContent>
		</Tabs>
	);
}
