"use client";
import type { Report as ReportData } from "cmdt-shared";
import { useEffect, useState } from "react";
import { useFilePicker } from "use-file-picker";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { H1 } from "@/components/ui/typography";
import Report from "./report";

export default function Home() {
	const { openFilePicker, filesContent } = useFilePicker({
		accept: ".cmdt",
	});

	const [report, setReport] = useState<null | ReportData>(null);
	useEffect(() => {
		if (!filesContent.length) return;
		const parsed = JSON.parse(filesContent[0]?.content);
		setReport(parsed);
	}, [filesContent]);
	return (
		<div className="p-2 font-[family-name:var(--font-geist-sans)] prose">
			<main className="flex flex-col items-center sm:items-start">
				<H1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">CMDT Report Viewer v{process.env.NEXT_PUBLIC_CMDT_VERSION}</H1>
				<Button className="mt-2" onClick={() => openFilePicker()}>
					Select report
				</Button>
				<Separator className="mt-5 mb-5" />
				{report && <Report rawReport={report} />}
			</main>
		</div>
	);
}
