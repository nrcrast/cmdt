"use client";

import type { Scte35Marker } from "cmdt-shared";
import { Code, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Scte35KVTable, spliceInfoToRows } from "./scte35-kv-table";
import {
	formatEnumValue,
	getCommandTypeSummary,
	getMarkerSummary,
	getUniqueCommandTypes,
	getUniqueSegmentationTypes,
	SEGMENTATION_TYPE_IDS,
	SPLICE_COMMAND_TYPES,
} from "./scte35-utils";

type Scte35MarkersProps = {
	markers: Array<Scte35Marker>;
};

export default function Scte35Markers({ markers }: Scte35MarkersProps) {
	const [commandFilter, setCommandFilter] = useState<string>("all");
	const [segmentationFilter, setSegmentationFilter] = useState<string>("all");
	const [searchText, setSearchText] = useState("");
	const [rawJsonExpanded, setRawJsonExpanded] = useState<Set<number>>(new Set());

	const uniqueCommandTypes = useMemo(() => getUniqueCommandTypes(markers ?? []), [markers]);
	const uniqueSegTypes = useMemo(() => getUniqueSegmentationTypes(markers ?? []), [markers]);

	const filteredMarkers = useMemo(() => {
		if (!markers) return [];
		return markers.filter((marker, _index) => {
			// biome-ignore lint/suspicious/noExplicitAny: ISpliceInfoSection is loosely typed
			const data = marker.data as any;

			// Command type filter
			if (commandFilter !== "all") {
				const cmdType = data?.spliceCommandType;
				if (cmdType === undefined || String(cmdType) !== commandFilter) return false;
			}

			// Segmentation type filter
			if (segmentationFilter !== "all") {
				const descriptors = data?.descriptors ?? [];
				const hasMatch = descriptors.some(
					// biome-ignore lint/suspicious/noExplicitAny: descriptor types are loosely typed
					(d: any) => d.segmentationTypeId !== undefined && String(d.segmentationTypeId) === segmentationFilter,
				);
				if (!hasMatch) return false;
			}

			// Free-text search
			if (searchText.trim()) {
				const summary = getMarkerSummary(marker).toLowerCase();
				const jsonStr = JSON.stringify(data).toLowerCase();
				const term = searchText.toLowerCase();
				if (!summary.includes(term) && !jsonStr.includes(term)) return false;
			}

			return true;
		});
	}, [markers, commandFilter, segmentationFilter, searchText]);

	// Empty state
	if (!markers || markers.length === 0) {
		return (
			<Alert>
				<AlertTitle>No SCTE-35 Markers</AlertTitle>
				<AlertDescription>No SCTE-35 markers were found in this manifest.</AlertDescription>
			</Alert>
		);
	}

	const toggleRawJson = (index: number) => {
		setRawJsonExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	return (
		<div className="space-y-4">
			{/* Summary stats */}
			<div className="text-sm text-muted-foreground">{getCommandTypeSummary(markers)}</div>

			{/* Filter bar */}
			<div className="flex flex-wrap items-center gap-3">
				<Select value={commandFilter} onValueChange={setCommandFilter}>
					<SelectTrigger className="w-[200px]" size="sm">
						<SelectValue placeholder="Command Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Command Types</SelectItem>
						{uniqueCommandTypes.map((t) => (
							<SelectItem key={t} value={String(t)}>
								{formatEnumValue(t, SPLICE_COMMAND_TYPES)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={segmentationFilter} onValueChange={setSegmentationFilter}>
					<SelectTrigger className="w-[220px]" size="sm">
						<SelectValue placeholder="Segmentation Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Segmentation Types</SelectItem>
						{uniqueSegTypes.map((t) => (
							<SelectItem key={t} value={String(t)}>
								{formatEnumValue(t, SEGMENTATION_TYPE_IDS)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search markers..."
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						className="pl-8 h-9"
					/>
				</div>
			</div>

			{/* Filtered count */}
			{filteredMarkers.length !== markers.length && (
				<div className="text-sm text-muted-foreground">
					Showing {filteredMarkers.length} of {markers.length} markers
				</div>
			)}

			{/* No results after filtering */}
			{filteredMarkers.length === 0 && (
				<Alert>
					<AlertTitle>No Matching Markers</AlertTitle>
					<AlertDescription>No markers match the current filters. Try adjusting your search criteria.</AlertDescription>
				</Alert>
			)}

			{/* Accordion marker list */}
			{filteredMarkers.length > 0 && (
				<Accordion type="multiple" className="w-full">
					{filteredMarkers.map((marker) => {
						const globalIndex = markers.indexOf(marker);
						const summary = getMarkerSummary(marker);
						const rows = spliceInfoToRows(marker.data);

						return (
							<AccordionItem key={`marker-${globalIndex}`} value={`marker-${globalIndex}`}>
								<AccordionTrigger className="text-sm font-mono">
									<span className="flex items-center gap-2">
										<span className="text-muted-foreground text-xs">#{globalIndex + 1}</span>
										{summary}
									</span>
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-3">
										<Scte35KVTable rows={rows} />
										<div className="flex justify-end">
											<Button
												variant="ghost"
												size="sm"
												className="text-xs text-muted-foreground"
												onClick={() => toggleRawJson(globalIndex)}
											>
												<Code className="h-3.5 w-3.5 mr-1" />
												{rawJsonExpanded.has(globalIndex) ? "Hide" : "Show"} Raw JSON
											</Button>
										</div>
										{rawJsonExpanded.has(globalIndex) && (
											<pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-96">
												{JSON.stringify(marker.data, null, 2)}
											</pre>
										)}
									</div>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			)}
		</div>
	);
}
