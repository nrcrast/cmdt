import type { ColumnDef } from "@tanstack/react-table";
import type { ContentProtection, Report } from "cmdt-shared";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { JsonEditor } from "json-edit-react";

export const columns: ColumnDef<Report["mismatchedContentProtection"][0]>[] = [
	{
		accessorKey: "type",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
		enableHiding: true,
		sortingFn: "basic",
	},
	{
		accessorKey: "detectedInMedia",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Detected in Media" />,
		enableHiding: true,
		sortingFn: "basic",
        cell: ({ row }) => <div className="text-wrap">{row.getValue('detectedInMedia')}</div>
	},
	{
		accessorKey: "detectedInManifest",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Expected in Manifest" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <div className="text-wrap">{row.getValue('detectedInManifest')}</div>
	},
	{
		accessorKey: "segment",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Segment" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <JsonEditor data={row.getValue('segment')} viewOnly={true} />
	},
];

const defaultVisibleColumns = {
	type: true,
	detectedInMedia: true,
	detectedInManifest: true,
	segment: false,
};

export default function MismatchedContentProtection(props: { report: Report}) {
    if(!props.report.mismatchedContentProtection.length) {
        return <h2>No mismatched content protection found</h2>;
    }
	return <DataTable columns={columns} data={props.report.mismatchedContentProtection} defaultVisibleColumns={defaultVisibleColumns} />;
}
