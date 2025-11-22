import type { ColumnDef } from "@tanstack/react-table";
import type { Report, Segment } from "cmdt-shared";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

export const columns: ColumnDef<Segment>[] = [
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
		accessorKey: "url",
		header: "URL",
		enableHiding: true,
		enableSorting: true,
	},
	{
		accessorKey: "initSegmentUrl",
		header: "Init Segment URL",
		enableHiding: true,
		enableSorting: true,
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
	url: false,
	initSegmentUrl: false,
	fileSystemPath: false,
	initSegmentFilesystemPath: false,
	baseMediaDecodeTime: false,
	mediaDuration: false,
	rawSegmentTime: false,
	contentProtection: true,
};

export function SegmentTable(props: { manifest: Report["manifest"]; segments: Array<Segment> }) {
	const hydratedSegments = props.segments.map((segment) => {
		return {
			...segment,
			contentProtection:
				segment.contentProtectionIds
					?.map((id) => {
						return `${props.manifest.contentProtection[id].type}(${id})`;
					})
					.join(" | ") ?? "None",
		};
	});
	return <DataTable columns={columns} data={hydratedSegments} defaultVisibleColumns={defaultVisibleColumns} />;
}
