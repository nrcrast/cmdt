import type { Cue, RawReport as Report } from "cmdt-shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { H4 } from "@/components/ui/typography";

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
				<AccordionContent>
					{Object.keys(missingCues[key]).map((cueId) => {
						const cue = captions?.[key]?.find((cue) => cue.id === cueId);
						if (!cue) {
							return null;
						}
						return (
							<div className="m-10" key={`missing-${key}-${cueId}`}>
								<H4>Caption:</H4>
								<Caption cue={cue}></Caption>
								<H4>Missing From Representations:</H4>
								<ul>
									{missingCues[key][cueId].map((representation) => {
										return <li key={`${key}-${representation}`}>{representation}</li>;
									})}
								</ul>
							</div>
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
