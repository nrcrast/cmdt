import type { RawReport as Report, Representation } from "cmdt-shared";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
						<Table className="mb-4">
							<TableBody>
								<TableRow>
									<TableCell className="font-medium">Type</TableCell>
									<TableCell>{representation.type}</TableCell>
								</TableRow>
								{representation.numChannels && (
									<TableRow>
										<TableCell className="font-medium">Channels</TableCell>
										<TableCell>{representation.numChannels}</TableCell>
									</TableRow>
								)}
								<TableRow>
									<TableCell className="font-medium">Bandwidth</TableCell>
									<TableCell>{representation.bandwidth}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">Codecs</TableCell>
									<TableCell>{representation.codecs}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">Spatial Audio</TableCell>
									<TableCell>
										<Badge variant={representation.spatialAudio ? "default" : "secondary"}>
											{representation.spatialAudio ? "Yes" : "No"}
										</Badge>
									</TableCell>
								</TableRow>
								{representation.language && (
									<TableRow>
										<TableCell className="font-medium">Language</TableCell>
										<TableCell>{representation.language}</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
						<SegmentTable manifest={props.manifest} segments={representation.segments} />
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
