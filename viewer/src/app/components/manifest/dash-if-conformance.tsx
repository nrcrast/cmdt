import type { RawReport as Report } from "cmdt-shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { H4 } from "@/components/ui/typography";

type PassOrFail = "PASS" | "FAIL";

type SchematronResults = {
	verdict: PassOrFail;
	MPD: {
		verdict: PassOrFail;
		info: Array<string>;
	};
};

function Schematron(props: { test: SchematronResults }) {
	return (
		<div>
			<H4>Status: {props.test.verdict}</H4>
			<ScrollArea className="h-72 rounded-md border" key="schematron-scroll">
				{props.test.MPD.info[0].split("\n").map((line) => {
					return <pre key={`schematron-result-${crypto.randomUUID()}`}>{line}</pre>;
				})}
			</ScrollArea>
		</div>
	);
}

export default function DashIfConformance(props: { report: Report }) {
	// biome-ignore lint/suspicious/noExplicitAny: Data is pass-through
	const dashReport = props.report.dashConformance as any;
	if (!dashReport) {
		return <h2>No DASH-IF conformance report found</h2>;
	}
	const schematronTest = dashReport.entries.Schematron;
	return (
		<div>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value="item-1">
					<AccordionTrigger>Schematron</AccordionTrigger>
					<AccordionContent>
						<Schematron test={schematronTest} />
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-2">
					<AccordionTrigger>MPEG-DASH Common</AccordionTrigger>
					<AccordionContent>
						<H4>Status: {dashReport?.entries["MPEG-DASH Common"]?.verdict ?? "N/A"}</H4>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-3">
					<AccordionTrigger>DASH-IF IOP Conformance</AccordionTrigger>
					<AccordionContent>
						<H4>Status: {dashReport?.entries["DASH-IF IOP Conformance"]?.verdict ?? "N/A"}</H4>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
