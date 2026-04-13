import type { RawReport as Report, Representation } from "cmdt-shared";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
									<TableCell className="font-medium">Codecs</TableCell>
									<TableCell>{representation.codecs}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">Resolution</TableCell>
									<TableCell>
										{representation.width} × {representation.height}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">CEA-608</TableCell>
									<TableCell>
										<Badge variant={representation.hasCaptions.cea608 ? "default" : "secondary"}>
											{representation.hasCaptions.cea608 ? "Yes" : "No"}
										</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">CEA-708</TableCell>
									<TableCell>
										<Badge variant={representation.hasCaptions.cea708 ? "default" : "secondary"}>
											{representation.hasCaptions.cea708 ? "Yes" : "No"}
										</Badge>
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
						<SegmentTable manifest={props.manifest} segments={representation.segments} />
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
