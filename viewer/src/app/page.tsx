"use client";
import axios from "axios";
import {
	CaptionExtractor,
	DownloadMode,
	DownloadModeInfo,
	EmsgExtractor,
	GapChecker,
	getManifestParser,
	PsshExtractor,
	type RawReport,
	Report as ReportData,
	SegmentDownloader,
	WebVttParser,
} from "cmdt-shared";
import { useEffect, useId, useState } from "react";
import { useFilePicker } from "use-file-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AppHeader } from "./components/app-header";
import { FilesystemWriter } from "./components/plugins/filesystem-writer";
import Report from "./report";

/**
 * Progress state for segment downloads
 */
type DownloadProgress = {
	status: "idle" | "downloading" | "done";
	current: number;
	total: number;
	startTime: number | null;
};

/**
 * Format milliseconds as "2m 34s" or "34s"
 */
function formatDuration(ms: number): string {
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

/**
 * Calculate ETA based on current progress
 */
function calculateETA(progress: DownloadProgress): string | null {
	if (!progress.startTime || progress.current === 0) {
		return null;
	}

	const elapsed = Date.now() - progress.startTime;
	const rate = progress.current / elapsed; // segments per ms
	const remaining = progress.total - progress.current;
	const etaMs = remaining / rate;

	return formatDuration(etaMs);
}

/**
 * When pasting a URI from your dev tools, sometimes it seems to jam weird escape characters into the search params
 * @param uri
 * @returns
 */
function sanitizeUri(uri: string): string {
	return uri.replaceAll("\\", "");
}

export default function Home() {
	const { openFilePicker, filesContent } = useFilePicker({
		accept: ".cmdt",
	});

	const [report, setReport] = useState<null | RawReport>(null);
	const [downloader, setDownloader] = useState<null | SegmentDownloader>(null);
	const [manifest, setManifest] = useState<string>("");
	const [downloadMode, setDownloadMode] = useState<DownloadMode>(DownloadMode.Full);
	const [downloadSegments, setDownloadSegments] = useState(false);
	const [segmentOutputDir, setSegmentOutputDir] = useState<null | FileSystemDirectoryHandle>(null);
	const [canSaveToFileSystem, setCanSaveToFileSystem] = useState(false);
	const downloadCheckboxId = useId();
	const [progress, setProgress] = useState<DownloadProgress>({
		status: "idle",
		current: 0,
		total: 0,
		startTime: null,
	});

	useEffect(() => {
		setCanSaveToFileSystem("showDirectoryPicker" in window);
	}, []);

	useEffect(() => {
		if (!filesContent.length) return;
		const parsed = JSON.parse(filesContent[0]?.content);
		setReport(parsed);
	}, [filesContent]);
	return (
		<div className="min-h-screen bg-background font-[family-name:var(--font-geist-sans)]">
			<main className="mx-auto max-w-4xl p-6 space-y-6">
				<AppHeader />

				<div className="grid gap-4 sm:grid-cols-2">
					{/* Option 1: Load from file */}
					<Card>
						<CardHeader>
							<CardTitle>Load Report File</CardTitle>
							<CardDescription>Open a previously saved .cmdt report</CardDescription>
						</CardHeader>
						<CardContent>
							<Button className="w-full" variant="outline" onClick={() => openFilePicker()}>
								Select report file
							</Button>
						</CardContent>
					</Card>

					{/* Option 2: Load from URL */}
					<Card>
						<CardHeader>
							<CardTitle>Analyze Manifest</CardTitle>
							<CardDescription>Download and analyze a DASH/HLS manifest</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<Input
								type="text"
								placeholder="Enter manifest URL"
								value={manifest}
								onChange={(e) => setManifest(e.target.value)}
							/>

							<div className="space-y-2">
								<Label>Download mode</Label>
								<ToggleGroup
									type="single"
									variant="outline"
									value={downloadMode}
									onValueChange={(value) => {
										if (value) setDownloadMode(value as DownloadMode);
									}}
									className="w-full"
								>
									{Object.values(DownloadMode).map((mode) => (
										<ToggleGroupItem key={mode} value={mode} className="flex-1">
											{DownloadModeInfo[mode].label}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
								<div className="min-h-20 space-y-1">
									<p className="text-sm text-muted-foreground">{DownloadModeInfo[downloadMode].long}</p>
									{DownloadModeInfo[downloadMode].degradedPlugins.length > 0 && (
										<p className="text-sm text-muted-foreground">
											Incomplete output for: {DownloadModeInfo[downloadMode].degradedPlugins.join(", ")}.
										</p>
									)}
								</div>
							</div>
							{canSaveToFileSystem && (
								<Field orientation="horizontal">
									<Checkbox
										id={downloadCheckboxId}
										name="download-segments"
										checked={downloadSegments}
										onCheckedChange={(checked) => setDownloadSegments(!!checked)}
									/>
									<Label htmlFor="download-segments">Download segments to Filesystem</Label>
								</Field>
							)}
							{downloadSegments && canSaveToFileSystem && (
								<Button
									className="w-full"
									variant="outline"
									onClick={async () => {
										const dir = await window.showDirectoryPicker();
										setSegmentOutputDir(dir);
										await dir.getDirectoryHandle("segments", { create: true });
									}}
								>
									Select segment output directory
								</Button>
							)}

							<Button
								className="w-full"
								disabled={!manifest || progress.status === "downloading"}
								onClick={async () => {
									const sanitizedManifest = sanitizeUri(manifest);
									const { data: manifestStr } = await axios.get(sanitizedManifest);
									const parser = getManifestParser(sanitizedManifest);
									const { manifest: manifestData } = await parser.parse(manifestStr, sanitizedManifest);
									const report = new ReportData();
									const plugins = [
										new CaptionExtractor(manifestData, report),
										new EmsgExtractor(manifestData, report),
										new GapChecker(manifestData, report),
										new PsshExtractor(manifestData, report),
										new WebVttParser(manifestData, report),
									];

									if (downloadSegments && segmentOutputDir && canSaveToFileSystem) {
										plugins.push(new FilesystemWriter(manifestData, report, segmentOutputDir));
									}

									const downloader = new SegmentDownloader(manifestData);
									setDownloader(downloader);

									// Set initial progress state with startTime
									setProgress({
										status: "downloading",
										current: 0,
										total: 0,
										startTime: Date.now(),
									});

									report.ingestManifest(manifestData);

									await downloader.start({
										batchSize: 5,
										downloadMode,
										onSegmentAvailable: async (segment, representation) => {
											for (const plugin of plugins) {
												await plugin.processSegment(segment, representation);
											}
											setReport(report.getRaw());
											segment.media?.free();
										},
										onProgress: (nSegment, totalSegments) => {
											setProgress((prev) => ({
												...prev,
												current: nSegment,
												total: totalSegments,
											}));
										},
									});

									for (const plugin of plugins) {
										await plugin.finalize();
									}

									setReport(report.getRaw());

									// Reset progress state when done
									setProgress({
										status: "done",
										current: 0,
										total: 0,
										startTime: null,
									});
								}}
							>
								{progress.status === "downloading" ? "Downloading..." : "Load Manifest"}
							</Button>

							{/* Progress display during download */}
							{progress.status === "downloading" && (
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Downloading segments...</span>
										<span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
									</div>
									<Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} />
									<div className="text-sm text-muted-foreground">
										{progress.current} / {progress.total} segments
										{progress.current > 0 && calculateETA(progress) && <> • ETA: {calculateETA(progress)}</>}
									</div>
									<Button onClick={() => downloader?.cancel()}>Cancel</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Report display */}
				{report && (
					<>
						<div className="flex items-center justify-between">
							<Separator className="flex-1" />
							<Button
								variant="outline"
								size="sm"
								className="ml-4"
								onClick={() => {
									const reportStr = JSON.stringify(report, null, 2);
									const blob = new Blob([reportStr], { type: "application/json" });
									const url = URL.createObjectURL(blob);
									const a = document.createElement("a");
									a.href = url;
									a.download = "report.cmdt";
									document.body.appendChild(a);
									a.click();
									document.body.removeChild(a);
									URL.revokeObjectURL(url);
								}}
							>
								Download Report (.cmdt)
							</Button>
						</div>
						<Report rawReport={report} />
					</>
				)}
			</main>
		</div>
	);
}
