"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
	table: Table<TData>;
	/** Id of the column the filter input targets. The input is only rendered when this column exists. */
	filterColumnId?: string;
}

export function DataTableToolbar<TData>({ table, filterColumnId = "text" }: DataTableToolbarProps<TData>) {
	const isFiltered = table.getState().columnFilters.length > 0;
	// Guard against TanStack's dev-only "Column with id 'x' does not exist" error:
	// only call getColumn when the target column is actually present.
	const filterColumn = table.getAllColumns().some((column) => column.id === filterColumnId)
		? table.getColumn(filterColumnId)
		: undefined;

	return (
		<div className="flex items-center justify-between">
			<div className="flex flex-1 items-center space-x-2">
				{filterColumn && (
					<Input
						placeholder="Filter..."
						value={(filterColumn.getFilterValue() as string) ?? ""}
						onChange={(event) => filterColumn.setFilterValue(event.target.value)}
						className="h-8 w-[150px] lg:w-[250px]"
					/>
				)}
				{isFiltered && (
					<Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
						Reset
						<X />
					</Button>
				)}
			</div>
			<DataTableViewOptions table={table} />
		</div>
	);
}
