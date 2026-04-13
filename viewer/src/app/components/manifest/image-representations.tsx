import type { ImageRepresentation } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageSegmentTable } from "./image-segment-table";

export default function ImageRepresentations(props: { representations: Array<ImageRepresentation> }) {
	// Handle empty state
	if (!props.representations || props.representations.length === 0) {
		return (
			<Alert>
				<AlertTitle>No Image Representations</AlertTitle>
				<AlertDescription>No image representations were found in this manifest.</AlertDescription>
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
							<TableRow>
								<TableCell className="font-medium">Bandwidth</TableCell>
								<TableCell>{representation.bandwidth}</TableCell>
							</TableRow>
							<TableRow>
								<TableCell className="font-medium">Resolution</TableCell>
								<TableCell>
									{representation.width} × {representation.height}
								</TableCell>
							</TableRow>
							<TableRow>
								<TableCell className="font-medium">Grid</TableCell>
								<TableCell>
									{representation.imageRows} × {representation.imageCols} (
									{representation.imageRows * representation.imageCols} thumbnails per sheet)
								</TableCell>
							</TableRow>
							<TableRow>
								<TableCell className="font-medium">Segments</TableCell>
								<TableCell>{representation.segments.length}</TableCell>
							</TableRow>
						</TableBody>
					</Table>
					<ImageSegmentTable segments={representation.segments} />
				</TabsContent>
			))}
		</Tabs>
	);
}
