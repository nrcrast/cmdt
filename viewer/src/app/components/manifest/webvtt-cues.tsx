"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { RawReport as Report } from "cmdt-shared";
import { formatTime } from "@/app/lib/format";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { CopyButton } from "../ui/copy-button";

type VttCue = {
	id: string;
	startTime: number;
	endTime: number;
	text: string;
};

export const columns: ColumnDef<VttCue>[] = [
	{
		accessorKey: "startTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTime(row.original.startTime),
	},
	{
		accessorKey: "endTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTime(row.original.endTime),
	},
	{
		accessorKey: "text",
		header: "Text",
		cell: ({ row }) => {
			const text = row.original.text;
			return (
				<div className="flex items-center gap-1">
					<span className="truncate max-w-md" title={text}>
						{text}
					</span>
					<CopyButton value={text} />
				</div>
			);
		},
	},
];

const defaultVisibleColumns = {
	startTime: true,
	endTime: true,
	text: true,
};

export default function WebVttCues(props: { report: Report }) {
	const textCues = props.report.textCues;

	// Handle empty state
	if (!textCues || !textCues.cues || textCues.cues.length === 0) {
		return (
			<Alert>
				<AlertTitle>No WebVTT Cues</AlertTitle>
				<AlertDescription>No WebVTT cues were found in this report.</AlertDescription>
			</Alert>
		);
	}

	const cues: VttCue[] = textCues.cues.map((cue, index) => ({
		id: cue.id || `cue-${index}`,
		startTime: cue.startTime,
		endTime: cue.endTime,
		text: cue.text,
	}));

	const styles = textCues.styles || [];

	return (
		<div className="space-y-4">
			<DataTable columns={columns} data={cues} defaultVisibleColumns={defaultVisibleColumns} />

			{styles.length > 0 && (
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value="styles">
						<AccordionTrigger>Styles ({styles.length})</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-2">
								{styles.map((style) => (
									<pre key={style} className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto">
										{style}
									</pre>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			)}
		</div>
	);
}
