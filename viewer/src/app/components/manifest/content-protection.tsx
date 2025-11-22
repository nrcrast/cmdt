import type { ColumnDef } from "@tanstack/react-table";
import type { ContentProtection } from "cmdt-shared";
import { JsonEditor } from "json-edit-react";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

export const columns: ColumnDef<ContentProtection>[] = [
	{
		accessorKey: "type",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "systemId",
		header: ({ column }) => <DataTableColumnHeader column={column} title="System ID" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "pssh",
		header: ({ column }) => <DataTableColumnHeader column={column} title="PSSH" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <div className="text-wrap">{row.getValue("pssh")}</div>,
	},
	{
		accessorKey: "parsedPssh",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Parsed PSSH" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <JsonEditor data={row.getValue("parsedPssh")} viewOnly={true} />,
	},
];

const defaultVisibleColumns = {
	type: true,
	systemId: true,
	parsedPssh: true,
	pssh: false,
};

export default function ContentProtectionDetails(props: { contentProtection: Array<ContentProtection> }) {
	return <DataTable columns={columns} data={props.contentProtection} defaultVisibleColumns={defaultVisibleColumns} />;
}
