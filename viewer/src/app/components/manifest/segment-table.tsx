import type { ColumnDef } from "@tanstack/react-table";
import type { RawReport as Report, Segment } from "cmdt-shared";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { CopyButton } from "../ui/copy-button";

type HydratedSegment = Segment & {
	contentProtection: string;
	urlString: string;
	initSegmentUrlString: string;
};

/**
 * Extract URL string from various possible formats after JSON serialization
 */
function getUrlString(url: unknown): string {
	if (!url) return "";
	if (typeof url === "string") return url;
	if (typeof url === "object" && "href" in url) return (url as { href: string }).href;
	return "";
}

export const columns: ColumnDef<HydratedSegment>[] = [
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
		accessorKey: "contentProtection",
		header: "Content Protection",
		enableHiding: true,
		enableSorting: true,
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
	{
		accessorKey: "initSegmentUrlString",
		header: "Init Segment URL",
		enableHiding: true,
		enableSorting: true,
		cell: ({ row }) => {
			const url = row.original.initSegmentUrlString;
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
	{
		accessorKey: "fileSystemPath",
		header: "File System Path",
		enableHiding: true,
		enableSorting: true,
	},
	{
		accessorKey: "initSegmentFilesystemPath",
		header: "Init Segment File System Path",
		enableHiding: true,
		enableSorting: true,
	},
	{
		accessorKey: "baseMediaDecodeTime",
		header: "Base Media Decode Time",
		enableHiding: true,
		enableSorting: true,
	},
	{
		accessorKey: "mediaDuration",
		header: "Media Duration",
		enableHiding: true,
		enableSorting: true,
	},
	{
		accessorKey: "rawSegmentTime",
		header: "Raw Segment Time",
		enableHiding: true,
		enableSorting: true,
	},
];

const defaultVisibleColumns = {
	startTime: true,
	duration: true,
	urlString: false,
	initSegmentUrlString: false,
	fileSystemPath: false,
	initSegmentFilesystemPath: false,
	baseMediaDecodeTime: false,
	mediaDuration: false,
	rawSegmentTime: false,
	contentProtection: true,
};

export function SegmentTable(props: { manifest: Report["manifest"]; segments: Array<Segment> }) {
	const hydratedSegments: HydratedSegment[] = props.segments.map((segment) => {
		return {
			...segment,
			contentProtection:
				segment.contentProtectionIds
					?.map((id) => {
						return `${props.manifest.contentProtection[id]?.type ?? "unknown"}(${id})`;
					})
					.join(" | ") ?? "None",
			urlString: getUrlString(segment.media?.url) || getUrlString(segment.url),
			initSegmentUrlString: getUrlString(segment.initSegment?.url),
		};
	});
	return <DataTable columns={columns} data={hydratedSegments} defaultVisibleColumns={defaultVisibleColumns} />;
}
