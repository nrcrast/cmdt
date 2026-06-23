"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Emsg, Segment } from "cmdt-shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { emsgDurationMs, emsgPresentationTimeMs } from "@/lib/emsg";
import { formatTimeMs } from "@/lib/format";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

type EmsgWithExpanded = Emsg & {
	isExpanded?: boolean;
};

/** Minimal segment context needed to place emsg events on the presentation timeline. */
type EmsgSegment = Pick<Segment, "startTime" | "rawSegmentTime">;

/**
 * Build the EMSG table columns. Presentation Time and Duration are converted from
 * raw timescale units into seconds using each event's timescale; presentation time
 * is realigned to the segment timeline via the containing segment.
 */
function buildColumns(segment: EmsgSegment): ColumnDef<EmsgWithExpanded>[] {
	return [
		{
			accessorKey: "id",
			header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
			enableHiding: true,
			sortingFn: "basic",
		},
		{
			accessorKey: "schemeIdUri",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Scheme URI" />,
			enableHiding: true,
			enableSorting: true,
		},
		{
			accessorKey: "value",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
			enableHiding: true,
			enableSorting: true,
		},
		{
			id: "presentationTime",
			accessorFn: (row) => emsgPresentationTimeMs(row, segment),
			header: ({ column }) => <DataTableColumnHeader column={column} title="Presentation Time" />,
			enableHiding: true,
			enableSorting: true,
			sortingFn: "basic",
			cell: ({ row }) => <span>{formatTimeMs(emsgPresentationTimeMs(row.original, segment))}</span>,
		},
		{
			id: "eventDuration",
			accessorFn: (row) => emsgDurationMs(row),
			header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
			enableHiding: true,
			enableSorting: true,
			sortingFn: "basic",
			cell: ({ row }) => <span>{formatTimeMs(emsgDurationMs(row.original))}</span>,
		},
		{
			accessorKey: "timescale",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Timescale" />,
			enableHiding: true,
			enableSorting: true,
		},
	];
}

const defaultVisibleColumns = {
	id: true,
	schemeIdUri: true,
	value: true,
	presentationTime: true,
	eventDuration: true,
	timescale: false,
};

export function EmsgTable(props: { emsgs: Array<Emsg>; segment: EmsgSegment }) {
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
	const columns = useMemo(() => buildColumns(props.segment), [props.segment]);

	const toggleRow = (index: number) => {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	return (
		<div className="space-y-4">
			<DataTable columns={columns} data={props.emsgs} defaultVisibleColumns={defaultVisibleColumns} />

			{/* Message Data Details */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium">Message Data</h4>
				{props.emsgs.map((emsg, index) => (
					<div key={`emsg-${emsg.id}-${emsg.presentationTime ?? index}`} className="border rounded-md">
						<Button
							variant="ghost"
							className="w-full justify-start text-left font-mono text-sm"
							onClick={() => toggleRow(index)}
						>
							{expandedRows.has(index) ? (
								<ChevronDown className="h-4 w-4 mr-2" />
							) : (
								<ChevronRight className="h-4 w-4 mr-2" />
							)}
							EMSG #{emsg.id} - {emsg.schemeIdUri}
						</Button>
						{expandedRows.has(index) && (
							<pre className="p-4 bg-muted text-xs overflow-auto max-h-64">
								{typeof emsg.messageData === "string" ? emsg.messageData : JSON.stringify(emsg.messageData, null, 2)}
							</pre>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
