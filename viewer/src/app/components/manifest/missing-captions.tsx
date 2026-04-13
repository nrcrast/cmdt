import type { Cue, RawReport as Report } from "cmdt-shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Caption(props: { cue: Cue }) {
	const { cue } = props;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[100px]">ID</TableHead>
					<TableHead>Begin</TableHead>
					<TableHead>End</TableHead>
					<TableHead>Position</TableHead>
					<TableHead>Text</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow key={cue.id}>
					<TableCell className="font-medium">{cue.id}</TableCell>
					<TableCell>{cue.begin.toFixed(2)}</TableCell>
					<TableCell>{cue.end.toFixed(2)}</TableCell>
					<TableCell>{cue.position}</TableCell>
					<TableCell>{cue.rawText}</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}

export default function MissingCaptions(props: { report: Report }) {
	const { missingCues, captions } = props.report;
	const captionItems = Object.keys(missingCues).map((key) => {
		return (
			<AccordionItem value={`item-${key}`} key={`item-${key}`}>
				<AccordionTrigger>Stream {key}</AccordionTrigger>
				<AccordionContent className="space-y-4 p-2">
					{Object.keys(missingCues[key]).map((cueId) => {
						const cue = captions?.[key]?.find((cue) => cue.id === cueId);
						if (!cue) {
							return null;
						}
						return (
							<Card key={`missing-${key}-${cueId}`}>
								<CardHeader>
									<CardTitle>Caption</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<Caption cue={cue} />
									<div>
										<p className="font-medium mb-2">Missing From Representations:</p>
										<div className="flex flex-wrap gap-2">
											{missingCues[key][cueId].map((representation) => (
												<Badge key={`${key}-${representation}`} variant="destructive">
													{representation}
												</Badge>
											))}
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</AccordionContent>
			</AccordionItem>
		);
	});
	return (
		<Accordion type="single" collapsible className="w-full">
			{captionItems}
		</Accordion>
	);
}
