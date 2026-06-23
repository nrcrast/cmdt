import type { ImageRepresentation } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageSegmentTable } from "./image-segment-table";
import RepresentationComparison from "./representation-comparison";

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
		<div className="space-y-6">
			<section className="space-y-2">
				<div>
					<h3 className="text-sm font-semibold">Rendition Comparison</h3>
					<p className="text-xs text-muted-foreground">
						Compare bandwidth, resolution, and thumbnail grid across all image renditions.
					</p>
				</div>
				<RepresentationComparison representations={props.representations} variant="image" />
			</section>
			<section className="space-y-2">
				<div>
					<h3 className="text-sm font-semibold">Segments</h3>
					<p className="text-xs text-muted-foreground">Select a rendition to view its segment list.</p>
				</div>
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
							<ImageSegmentTable segments={representation.segments} />
						</TabsContent>
					))}
				</Tabs>
			</section>
		</div>
	);
}
