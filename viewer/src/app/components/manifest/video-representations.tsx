import type { RawReport as Report, Representation } from "cmdt-shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RepresentationComparison from "./representation-comparison";
import { SegmentTable } from "./segment-table";

export default function VideoRepresentations(props: {
	manifest: Report["manifest"];
	representations: Array<Representation>;
}) {
	if (!props.representations.length) {
		return (
			<Alert>
				<AlertTitle>No Video Representations</AlertTitle>
				<AlertDescription>No video representations were found in this manifest.</AlertDescription>
			</Alert>
		);
	}
	return (
		<div className="space-y-6">
			<section className="space-y-2">
				<div>
					<h3 className="text-sm font-semibold">Rendition Comparison</h3>
					<p className="text-xs text-muted-foreground">
						Compare bandwidth, resolution, codecs, and captions across all video renditions.
					</p>
				</div>
				<RepresentationComparison representations={props.representations} variant="video" />
			</section>
			<section className="space-y-2">
				<div>
					<h3 className="text-sm font-semibold">Segments</h3>
					<p className="text-xs text-muted-foreground">Select a rendition to view its segment list.</p>
				</div>
				<Tabs defaultValue={props.representations[0]?.id}>
					<TabsList>
						{props.representations.map((representation) => {
							return (
								<TabsTrigger value={representation.id} key={`trigger-${representation.id}`}>
									{representation.id}
								</TabsTrigger>
							);
						})}
					</TabsList>
					{props.representations.map((representation) => {
						return (
							<TabsContent value={representation.id} key={`content-${representation.id}`}>
								<SegmentTable manifest={props.manifest} segments={representation.segments} />
							</TabsContent>
						);
					})}
				</Tabs>
			</section>
		</div>
	);
}
