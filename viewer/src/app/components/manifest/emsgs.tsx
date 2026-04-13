import type { RawReport } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
			<Alert>
				<AlertTitle>No Event Messages</AlertTitle>
				<AlertDescription>No event messages were found in this report.</AlertDescription>
			</Alert>
		);
	}

	// Filter out representations with no EMSGs
	const representationsWithEmsgs = emsgEntries.filter(([_, data]) => data.emsgs && data.emsgs.length > 0);

	if (representationsWithEmsgs.length === 0) {
		return (
			<Alert>
				<AlertTitle>No Event Messages</AlertTitle>
				<AlertDescription>No event messages were found in this report.</AlertDescription>
			</Alert>
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
						<Table className="mb-4">
							<TableBody>
								<TableRow>
									<TableCell className="font-medium">Representation</TableCell>
									<TableCell>{repId}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">Total EMSGs</TableCell>
									<TableCell>{data.emsgs.length}</TableCell>
								</TableRow>
							</TableBody>
						</Table>
						<EmsgTable emsgs={data.emsgs} />
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
