import type { ImageRepresentation, Period, RawReport as ReportData } from "cmdt-shared";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AudioRepresentations from "./components/manifest/audio-representations";
import Captions from "./components/manifest/captions";
import ContentProtection from "./components/manifest/content-protection";
import DashIfConformance from "./components/manifest/dash-if-conformance";
import Emsgs from "./components/manifest/emsgs";
import ImageRepresentations from "./components/manifest/image-representations";
import MismatchedContentProtection from "./components/manifest/mismatched-content-protection";
import MissingCaptions from "./components/manifest/missing-captions";
import Periods from "./components/manifest/periods";
import VideoRepresentations from "./components/manifest/video-representations";

export default function Report(props: { rawReport: ReportData }) {
	const { rawReport } = props;
	return (
		<div className="space-y-4">
			<Tabs defaultValue="manifest">
				<TabsList>
					<TabsTrigger value="manifest">Manifest</TabsTrigger>
					<TabsTrigger value="missing-captions">Missing Captions</TabsTrigger>
					<TabsTrigger value="dash-if-conformance">DASH-IF Conformance</TabsTrigger>
					<TabsTrigger value="mismatched-content-protection">Mismatched Content Protection</TabsTrigger>
					<TabsTrigger value="captions">Captions</TabsTrigger>
					<TabsTrigger value="emsgs">EMSGs</TabsTrigger>
				</TabsList>
				<TabsContent value="manifest">
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="item-1">
							<AccordionTrigger>Audio Representations</AccordionTrigger>
							<AccordionContent>
								<AudioRepresentations manifest={rawReport.manifest} representations={rawReport.manifest.audio} />
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="item-2">
							<AccordionTrigger>Video Representations</AccordionTrigger>
							<AccordionContent>
								<VideoRepresentations manifest={rawReport.manifest} representations={rawReport.manifest.video} />
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="item-3">
							<AccordionTrigger>Image Representations</AccordionTrigger>
							<AccordionContent>
								<ImageRepresentations representations={rawReport.manifest.images as ImageRepresentation[]} />
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="item-4">
							<AccordionTrigger>Content Protection</AccordionTrigger>
							<AccordionContent>
								<ContentProtection contentProtection={rawReport.manifest.contentProtection} />
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="item-5">
							<AccordionTrigger>Periods</AccordionTrigger>
							<AccordionContent>
								<Periods periods={rawReport.manifest.periods as Period[]} />
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</TabsContent>
				<TabsContent value="missing-captions">
					<MissingCaptions report={rawReport} />
				</TabsContent>
				<TabsContent value="mismatched-content-protection">
					<MismatchedContentProtection report={rawReport} />
				</TabsContent>
				<TabsContent value="dash-if-conformance">
					<DashIfConformance report={rawReport} />
				</TabsContent>
				<TabsContent value="captions">
					<Captions report={rawReport} />
				</TabsContent>
				<TabsContent value="emsgs">
					<Emsgs report={rawReport} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
