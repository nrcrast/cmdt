import type { ImageRepresentation } from "cmdt-shared";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageSegmentTable } from "./image-segment-table";

export default function ImageRepresentations(props: { representations: Array<ImageRepresentation> }) {
	// Handle empty state
	if (!props.representations || props.representations.length === 0) {
		return (
			<div className="flex items-center justify-center p-8 text-muted-foreground">No image representations found</div>
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
					<ul className="mb-4">
						<li>Type: {representation.type}</li>
						<li>Bandwidth: {representation.bandwidth}</li>
						<li>
							Resolution: {representation.width}x{representation.height}
						</li>
						<li>
							Grid: {representation.imageRows}x{representation.imageCols} (
							{representation.imageRows * representation.imageCols} thumbnails per sheet)
						</li>
						<li>Segments: {representation.segments.length}</li>
					</ul>
					<ImageSegmentTable segments={representation.segments} />
				</TabsContent>
			))}
		</Tabs>
	);
}
