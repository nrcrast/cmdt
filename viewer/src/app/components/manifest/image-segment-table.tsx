import type { ColumnDef } from "@tanstack/react-table";
import type { Segment } from "cmdt-shared";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

type ImageSegment = Segment & {
	urlString: string;
};

/**
 * Extract URL string from a segment.
 * When serialized to JSON, URL objects become either:
 * - A string (just the href)
 * - An object with href property
 * - The DownloadableChunk with url.href
 */
function getSegmentUrl(segment: Segment): string {
	// Try media.url first (for downloaded segments)
	if (segment.media?.url) {
		if (typeof segment.media.url === "string") return segment.media.url;
		if (typeof segment.media.url === "object" && "href" in segment.media.url) {
			return segment.media.url.href;
		}
	}
	// Fall back to segment.url
	if (segment.url) {
		if (typeof segment.url === "string") return segment.url;
		if (typeof segment.url === "object" && "href" in segment.url) {
			return segment.url.href;
		}
	}
	return "";
}

export const columns: ColumnDef<ImageSegment>[] = [
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
		id: "preview",
		header: "Preview",
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
	preview: true,
	urlString: true,
};

export function ImageSegmentTable(props: { segments: Array<Segment> }) {
	const hydratedSegments: ImageSegment[] = props.segments.map((segment) => ({
		...segment,
		urlString: getSegmentUrl(segment),
	}));

	return <DataTable columns={columns} data={hydratedSegments} defaultVisibleColumns={defaultVisibleColumns} />;
}
