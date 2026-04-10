import type { RawReport as Report, Representation } from "cmdt-shared";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentTable } from "./segment-table";

export default function AudioRepresentations(props: {
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
							{representation.numChannels && <li>Channels: {representation.numChannels}</li>}
							<li>Bandwidth: {representation.bandwidth}</li>
							<li>Codecs: {representation.codecs}</li>
							<li>Spatial: {`${representation.spatialAudio ?? false}`}</li>
							{representation.language && <li>Language: {representation.language}</li>}
						</ul>
						<SegmentTable manifest={props.manifest} segments={representation.segments} />
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
