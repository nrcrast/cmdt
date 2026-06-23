"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { RawReport as Report } from "cmdt-shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimeSeconds } from "@/lib/format";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

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
		cell: ({ row }) => formatTimeSeconds(row.original.startTime),
	},
	{
		accessorKey: "endTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => formatTimeSeconds(row.original.endTime),
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

/** Tab label for a rendition: prefer language, falling back to the representation id. */
function renditionLabel(repId: string, language?: string): string {
	return language ? `${language} (${repId})` : repId;
}

function RenditionCues(props: { cues: VttCue[]; styles: string[] }) {
	return (
		<div className="space-y-4">
			<DataTable columns={columns} data={props.cues} defaultVisibleColumns={defaultVisibleColumns} />

			{props.styles.length > 0 && (
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value="styles">
						<AccordionTrigger>Styles ({props.styles.length})</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-2">
								{props.styles.map((style) => (
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

export default function WebVttCues(props: { report: Report }) {
	// Guard against reports that predate the per-rendition textCues shape: only keep
	// entries that are proper rendition objects with a non-empty cues array.
	const renditions = Object.entries(props.report.textCues ?? {}).filter(
		([, data]) => Array.isArray(data?.cues) && data.cues.length > 0,
	);

	// Handle empty state
	if (renditions.length === 0) {
		return (
			<Alert>
				<AlertTitle>No WebVTT Cues</AlertTitle>
				<AlertDescription>No WebVTT cues were found in this report.</AlertDescription>
			</Alert>
		);
	}

	const totalCues = renditions.reduce((acc, [, data]) => acc + data.cues.length, 0);

	return (
		<div>
			<div className="mb-4 text-sm text-muted-foreground">
				Found {totalCues} cues across {renditions.length} rendition(s)
			</div>
			<Tabs defaultValue={renditions[0]?.[0]}>
				<TabsList>
					{renditions.map(([repId, data]) => (
						<TabsTrigger value={repId} key={`trigger-${repId}`}>
							{renditionLabel(repId, data.language)} ({data.cues.length})
						</TabsTrigger>
					))}
				</TabsList>
				{renditions.map(([repId, data]) => (
					<TabsContent value={repId} key={`content-${repId}`}>
						<RenditionCues
							cues={data.cues.map((cue, index) => ({
								id: cue.id || `cue-${index}`,
								startTime: cue.startTime,
								endTime: cue.endTime,
								text: cue.text,
							}))}
							styles={data.styles ?? []}
						/>
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
