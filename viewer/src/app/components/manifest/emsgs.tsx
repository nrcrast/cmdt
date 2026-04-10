import type { RawReport } from "cmdt-shared";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmsgTable } from "./emsg-table";

type EmsgsProps = {
	report: RawReport;
};

export default function Emsgs({ report }: EmsgsProps) {
	const emsgEntries = Object.entries(report.emsgs);

	// Handle empty state
	if (emsgEntries.length === 0) {
		return (
			<div className="flex items-center justify-center p-8 text-muted-foreground">
				No event messages found in this report
			</div>
		);
	}

	// Filter out representations with no EMSGs
	const representationsWithEmsgs = emsgEntries.filter(([_, data]) => data.emsgs && data.emsgs.length > 0);

	if (representationsWithEmsgs.length === 0) {
		return (
			<div className="flex items-center justify-center p-8 text-muted-foreground">
				No event messages found in this report
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 text-sm text-muted-foreground">
				Found {representationsWithEmsgs.reduce((acc, [_, data]) => acc + data.emsgs.length, 0)} event messages across{" "}
				{representationsWithEmsgs.length} representation(s)
			</div>
			<Tabs defaultValue={representationsWithEmsgs[0]?.[0]}>
				<TabsList>
					{representationsWithEmsgs.map(([repId, data]) => (
						<TabsTrigger value={repId} key={`trigger-${repId}`}>
							{repId} ({data.emsgs.length})
						</TabsTrigger>
					))}
				</TabsList>
				{representationsWithEmsgs.map(([repId, data]) => (
					<TabsContent value={repId} key={`content-${repId}`}>
						<ul className="mb-4">
							<li>Representation: {repId}</li>
							<li>Total EMSGs: {data.emsgs.length}</li>
						</ul>
						<EmsgTable emsgs={data.emsgs} />
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
