import type { Representation } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextSegmentTable } from "./text-segment-table";

export default function TextRepresentations(props: { representations: Array<Representation> }) {
	// Handle empty state
	if (!props.representations || props.representations.length === 0) {
		return (
			<Alert>
				<AlertTitle>No Text Representations</AlertTitle>
				<AlertDescription>No text representations were found in this manifest.</AlertDescription>
			</Alert>
		);
	}

	return (
		<Tabs defaultValue={props.representations[0]?.id}>
			<TabsList>
				{props.representations.map((representation) => (
					<TabsTrigger value={representation.id} key={`trigger-${representation.id}`}>
						{representation.id}
					</TabsTrigger>
				))}
			</TabsList>
			{props.representations.map((representation) => (
				<TabsContent value={representation.id} key={`content-${representation.id}`}>
					<Table className="mb-4">
						<TableBody>
							<TableRow>
								<TableCell className="font-medium">Type</TableCell>
								<TableCell>{representation.type}</TableCell>
							</TableRow>
							{representation.language && (
								<TableRow>
									<TableCell className="font-medium">Language</TableCell>
									<TableCell>{representation.language}</TableCell>
								</TableRow>
							)}
							{representation.codecs && (
								<TableRow>
									<TableCell className="font-medium">Codecs</TableCell>
									<TableCell>{representation.codecs}</TableCell>
								</TableRow>
							)}
							<TableRow>
								<TableCell className="font-medium">Segments</TableCell>
								<TableCell>{representation.segments.length}</TableCell>
							</TableRow>
						</TableBody>
					</Table>
					<TextSegmentTable segments={representation.segments} />
				</TabsContent>
			))}
		</Tabs>
	);
}
