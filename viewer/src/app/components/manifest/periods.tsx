import type { ColumnDef } from "@tanstack/react-table";
import type { Period } from "cmdt-shared";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

export const columns: ColumnDef<Period>[] = [
	{
		accessorKey: "baseUrl",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Base URL" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "id",
		header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "startString",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Start Attribute String" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "start",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Start Time" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "absoluteStartMs",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Absolute Start Time" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "duration",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "end",
		header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "startPrevEnd",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Start Time Matches Previous Periods End Time" />
		),
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "periodOverlap",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Start Time Overlaps Previous Period End Time" />
		),
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "segmentsAvailable",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Number of Segments Available" />,
		enableHiding: true,
		sortingFn: "basic",
	},
];

const defaultVisibleColumns = {
	id: true,
	start: true,
	duration: true,
	end: true,
	startPrevEnd: true,
	periodOverlap: true,
	absoluteStartMs: false,
	baseUrl: false,
	startString: false,
	segmentsAvailable: false,
};

export default function Periods(props: { periods: Array<Period> }) {
	return <DataTable columns={columns} data={props.periods} defaultVisibleColumns={defaultVisibleColumns} />;
}
