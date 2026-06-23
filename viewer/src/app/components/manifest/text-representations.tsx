import type { Representation } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RepresentationComparison from "./representation-comparison";
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
		<div className="space-y-6">
			<section className="space-y-2">
				<div>
					<h3 className="text-sm font-semibold">Rendition Comparison</h3>
					<p className="text-xs text-muted-foreground">
						Compare language, codecs, and segment counts across all text renditions.
					</p>
				</div>
				<RepresentationComparison representations={props.representations} variant="text" />
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
							<TextSegmentTable segments={representation.segments} />
						</TabsContent>
					))}
				</Tabs>
			</section>
		</div>
	);
}
