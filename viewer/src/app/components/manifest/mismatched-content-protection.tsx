import type { ColumnDef } from "@tanstack/react-table";
import type { RawReport as Report } from "cmdt-shared";
import { JsonEditor } from "json-edit-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable } from "../data-table/data-table";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";

type MismatchedContentProtectionEntry = Report["mismatchedContentProtection"][0];

export const columns: ColumnDef<MismatchedContentProtectionEntry>[] = [
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
		cell: ({ row }) => <JsonEditor data={row.getValue("detectedInMedia")} viewOnly={true} />,
	},
	{
		accessorKey: "expectedInManifest",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Expected in Manifest" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <JsonEditor data={row.getValue("expectedInManifest")} viewOnly={true} />,
	},
	{
		accessorKey: "segment",
		header: ({ column }) => <DataTableColumnHeader column={column} title="Segment" />,
		enableHiding: true,
		sortingFn: "basic",
		cell: ({ row }) => <JsonEditor data={row.getValue("segment")} viewOnly={true} />,
	},
];

const defaultVisibleColumns = {
	type: true,
	detectedInMedia: true,
	detectedInManifest: true,
	segment: false,
};

export default function MismatchedContentProtection(props: { report: Report }) {
	if (!props.report.mismatchedContentProtection.length) {
		return (
			<Alert>
				<AlertTitle>No Mismatches Found</AlertTitle>
				<AlertDescription>No mismatched content protection was detected in this report.</AlertDescription>
			</Alert>
		);
	}
	return (
		<DataTable
			columns={columns}
			data={props.report.mismatchedContentProtection}
			defaultVisibleColumns={defaultVisibleColumns}
		/>
	);
}
