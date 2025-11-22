import type { Report, Representation } from "cmdt-shared";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentTable } from "./segment-table";

export default function VideoRepresentations(props: {
	manifest: Report["manifest"];
	representations: Array<Representation>;
}) {
	return (
		<Tabs>
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
						<ul>
							<li>Type: {representation.type}</li>
							<li>Bandwidth: {representation.bandwidth}</li>
							<li>Codecs: {representation.codecs}</li>
							<li>Height: {representation.height}</li>
							<li>Width: {representation.width}</li>
							<li>CEA-608: {`${representation.hasCaptions.cea608}`}</li>
							<li>CEA-708: {`${representation.hasCaptions.cea708}`}</li>
						</ul>
						<SegmentTable manifest={props.manifest} segments={representation.segments} />
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
