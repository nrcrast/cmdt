import type { RawReport as Report } from "cmdt-shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type PassOrFail = "PASS" | "FAIL";

type SchematronResults = {
	verdict: PassOrFail;
	MPD: {
		verdict: PassOrFail;
		info: Array<string>;
	};
};

function VerdictBadge({ verdict }: { verdict: PassOrFail | string }) {
	return <Badge variant={verdict === "FAIL" ? "destructive" : "secondary"}>{verdict}</Badge>;
}

function Schematron(props: { test: SchematronResults }) {
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="font-medium">Status:</span>
				<VerdictBadge verdict={props.test.verdict} />
			</div>
			<ScrollArea className="h-72 rounded-md border" key="schematron-scroll">
				<code className="block p-4 text-sm font-[family-name:var(--font-geist-mono)]">
					{props.test.MPD.info[0].split("\n").map((line, i) => (
						<span key={`schematron-line-${i}`} className="block">
							{line}
						</span>
					))}
				</code>
			</ScrollArea>
		</div>
	);
}

export default function DashIfConformance(props: { report: Report }) {
	// biome-ignore lint/suspicious/noExplicitAny: Data is pass-through
	const dashReport = props.report.dashConformance as any;
	if (!dashReport) {
		return (
			<Alert>
				<AlertTitle>No Conformance Report</AlertTitle>
				<AlertDescription>No DASH-IF conformance report was found in this report data.</AlertDescription>
			</Alert>
		);
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
						<div className="flex items-center gap-2">
							<span className="font-medium">Status:</span>
							<VerdictBadge verdict={dashReport?.entries["MPEG-DASH Common"]?.verdict ?? "N/A"} />
						</div>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-3">
					<AccordionTrigger>DASH-IF IOP Conformance</AccordionTrigger>
					<AccordionContent>
						<div className="flex items-center gap-2">
							<span className="font-medium">Status:</span>
							<VerdictBadge verdict={dashReport?.entries["DASH-IF IOP Conformance"]?.verdict ?? "N/A"} />
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
