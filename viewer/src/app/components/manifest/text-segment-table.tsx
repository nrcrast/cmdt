import type { ColumnDef } from "@tanstack/react-table";
import type { Segment } from "cmdt-shared";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { CopyButton } from "../ui/copy-button";

type TextSegment = Segment & {
	urlString: string;
};

/**
 * Extract URL string from a segment.
 */
function getSegmentUrl(segment: Segment): string {
	if (segment.media?.url) {
		if (typeof segment.media.url === "string") return segment.media.url;
		if (typeof segment.media.url === "object" && "href" in segment.media.url) {
			return segment.media.url.href;
		}
	}
	if (segment.url) {
		if (typeof segment.url === "string") return segment.url;
		if (typeof segment.url === "object" && "href" in segment.url) {
			return segment.url.href;
		}
	}
	return "";
}

export const columns: ColumnDef<TextSegment>[] = [
	{
		accessorKey: "startTime",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Start Time" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "duration",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
		enableHiding: true,
		enableSorting: true,
		sortingFn: "basic",
	},
	{
		id: "view",
		header: "View",
		cell: ({ row }) => {
			const url = row.original.urlString;
			if (!url) return <span className="text-muted-foreground">N/A</span>;
			return (
				<Button variant="ghost" size="sm" asChild>
					<a href={url} target="_blank" rel="noopener noreferrer">
						<ExternalLink className="h-4 w-4 mr-1" />
						View
					</a>
				</Button>
			);
		},
	},
	{
		accessorKey: "urlString",
		header: "URL",
		enableHiding: true,
		enableSorting: true,
		cell: ({ row }) => {
			const url = row.original.urlString;
			if (!url) return <span className="text-muted-foreground">N/A</span>;
			return (
				<div className="flex items-center gap-1">
					<span className="font-mono text-xs truncate max-w-xs" title={url}>
						{url}
					</span>
					<CopyButton value={url} />
				</div>
			);
		},
	},
];

const defaultVisibleColumns = {
	startTime: true,
	duration: true,
	view: true,
	urlString: true,
};

export function TextSegmentTable(props: { segments: Array<Segment> }) {
	const hydratedSegments: TextSegment[] = props.segments.map((segment) => ({
		...segment,
		urlString: getSegmentUrl(segment),
	}));

	return <DataTable columns={columns} data={hydratedSegments} defaultVisibleColumns={defaultVisibleColumns} />;
}
