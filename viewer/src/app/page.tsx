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
import { Github, Globe } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useFilePicker } from "use-file-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AppHeader } from "./components/app-header";
import {
	type DownloadTuning,
	DownloadTuningSelector,
	defaultDownloadTuning,
	getDownloadTuningError,
	resolveDownloadTuning,
} from "./components/download-tuning-selector";
import { LogLevelToggle } from "./components/log-level-toggle";
import { ModeToggle } from "./components/mode-toggle";
import { FilesystemWriter } from "./components/plugins/filesystem-writer";
import {
	defaultSegmentRangeSelection,
	getSegmentRangeError,
	resolveSegmentRange,
	type SegmentRangeSelection,
	SegmentRangeSelector,
} from "./components/segment-range-selector";
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

/**
 * DASH/HLS detection for uploaded manifests, where no real URL is available
 */
type ManifestType = "dash" | "hls" | "unknown";

/**
 * Detect the manifest type from its content, falling back to the file extension
 * when content sniffing is inconclusive.
 */
function detectManifestType(content: string, fileName?: string): ManifestType {
	const trimmed = content.trimStart();
	if (trimmed.startsWith("#EXTM3U")) return "hls";
	if (trimmed.startsWith("<") && trimmed.includes("<MPD")) return "dash";

	const lower = (fileName ?? "").toLocaleLowerCase();
	if (lower.endsWith(".m3u8")) return "hls";
	if (lower.endsWith(".mpd")) return "dash";
	return "unknown";
}

/**
 * Build a synthetic manifest URL whose extension matches the detected type so the
 * URL-based parser factory selects the correct parser without a real URL.
 */
function buildSyntheticUrl(type: ManifestType): string {
	const ext = type === "hls" ? "m3u8" : "mpd";
	return `https://manifest.local/manifest.${ext}`;
}

export default function Home() {
	const { openFilePicker, filesContent } = useFilePicker({
		accept: ".cmdt",
	});
	const { openFilePicker: openManifestPicker, filesContent: manifestFilesContent } = useFilePicker({
		accept: [".mpd", ".m3u8", ".xml"],
	});

	const [report, setReport] = useState<null | RawReport>(null);
	const [downloader, setDownloader] = useState<null | SegmentDownloader>(null);
	const [manifest, setManifest] = useState<string>("");
	const [downloadMode, setDownloadMode] = useState<DownloadMode>(DownloadMode.Full);
	const [rangeSelection, setRangeSelection] = useState<SegmentRangeSelection>(defaultSegmentRangeSelection);
	const [uploadRangeSelection, setUploadRangeSelection] = useState<SegmentRangeSelection>(defaultSegmentRangeSelection);
	const [tuning, setTuning] = useState<DownloadTuning>(defaultDownloadTuning);
	const [downloadSegments, setDownloadSegments] = useState(false);
	const [segmentOutputDir, setSegmentOutputDir] = useState<null | FileSystemDirectoryHandle>(null);
	const [canSaveToFileSystem, setCanSaveToFileSystem] = useState(false);
	const downloadCheckboxId = useId();
	const uploadBaseUrlId = useId();
	const [progress, setProgress] = useState<DownloadProgress>({
		status: "idle",
		current: 0,
		total: 0,
		startTime: null,
	});
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [manifestFileContent, setManifestFileContent] = useState<string | null>(null);
	const [manifestFileName, setManifestFileName] = useState<string | null>(null);
	const [uploadBaseUrl, setUploadBaseUrl] = useState<string>("");
	const [uploadDownloadMode, setUploadDownloadMode] = useState<DownloadMode>(DownloadMode.ManifestOnly);

	useEffect(() => {
		setCanSaveToFileSystem("showDirectoryPicker" in window);
	}, []);

	useEffect(() => {
		if (!filesContent.length) return;
		const parsed = JSON.parse(filesContent[0]?.content);
		setReport(parsed);
	}, [filesContent]);

	useEffect(() => {
		if (!manifestFilesContent.length) return;
		const file = manifestFilesContent[0];
		setManifestFileContent(file.content);
		setManifestFileName(file.name);
		setAnalysisError(null);
	}, [manifestFilesContent]);

	/**
	 * Shared analysis pipeline used by both the URL and upload paths: parse the
	 * manifest text, run the plugins, drive the downloader, and emit the report.
	 */
	async function analyzeManifest({
		manifestStr,
		manifestUrl,
		baseUrl,
		mode,
		range,
		tuning,
	}: {
		manifestStr: string;
		manifestUrl: string;
		baseUrl?: string;
		mode: DownloadMode;
		range: SegmentRangeSelection;
		tuning: DownloadTuning;
	}) {
		const parser = getManifestParser(manifestUrl);
		const { manifest: manifestData } = await parser.parse(manifestStr, manifestUrl, baseUrl);
		// The downloader only understands absolute times; resolve the (possibly
		// live-edge-relative) selection now that the manifest — and its live edge — is known.
		const downloadTimeRange = resolveSegmentRange(range, manifestData);
		const { concurrency, numRetries } = resolveDownloadTuning(tuning);
		const reportData = new ReportData();
		const plugins = [
			new CaptionExtractor(manifestData, reportData),
			new EmsgExtractor(manifestData, reportData),
			new GapChecker(manifestData, reportData),
			new PsshExtractor(manifestData, reportData),
			new WebVttParser(manifestData, reportData),
		];

		if (downloadSegments && segmentOutputDir && canSaveToFileSystem) {
			plugins.push(new FilesystemWriter(manifestData, reportData, segmentOutputDir));
		}

		const segmentDownloader = new SegmentDownloader(manifestData);
		setDownloader(segmentDownloader);

		// Set initial progress state with startTime
		setProgress({
			status: "downloading",
			current: 0,
			total: 0,
			startTime: Date.now(),
		});

		reportData.ingestManifest(manifestData);

		await segmentDownloader.start({
			downloadMode: mode,
			downloadTimeRange,
			concurrency,
			numRetries,
			onSegmentAvailable: async (segment, representation) => {
				for (const plugin of plugins) {
					await plugin.processSegment(segment, representation);
				}
				setReport(reportData.getRaw());
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

		setReport(reportData.getRaw());

		// Reset progress state when done
		setProgress({
			status: "done",
			current: 0,
			total: 0,
			startTime: null,
		});
	}

	const detectedType: ManifestType = manifestFileContent
		? detectManifestType(manifestFileContent, manifestFileName ?? undefined)
		: "unknown";
	const hasUploadBaseUrl = uploadBaseUrl.trim().length > 0;
	const effectiveUploadMode = hasUploadBaseUrl ? uploadDownloadMode : DownloadMode.ManifestOnly;

	return (
		<div className="min-h-screen bg-background font-[family-name:var(--font-geist-sans)]">
			<main className="mx-auto max-w-4xl p-6 space-y-6">
				<div className="flex items-start justify-between gap-4">
					<AppHeader />
					<div className="flex items-center gap-2">
						<Button variant="outline" size="icon" asChild aria-label="GitHub repository">
							<a href="https://github.com/nrcrast/cmdt" target="_blank" rel="noopener noreferrer">
								<Github className="size-4" />
							</a>
						</Button>
						<Button variant="outline" size="icon" asChild aria-label="Website (cra.st)">
							<a href="https://cra.st" target="_blank" rel="noopener noreferrer">
								<Globe className="size-4" />
							</a>
						</Button>
						<LogLevelToggle />
						<ModeToggle />
					</div>
				</div>

				<div className="space-y-4">
					{/* Primary flow: analyze a manifest via URL or file upload */}
					<Card>
						<CardHeader>
							<CardTitle>Analyze Manifest</CardTitle>
							<CardDescription>Download from a URL or upload a local DASH/HLS manifest</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Tabs defaultValue="url" className="w-full">
								<TabsList className="grid w-full grid-cols-2">
									<TabsTrigger value="url">From URL</TabsTrigger>
									<TabsTrigger value="upload">Upload file</TabsTrigger>
								</TabsList>

								<TabsContent value="url" className="space-y-3">
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
									{downloadMode !== DownloadMode.ManifestOnly && (
										<>
											<SegmentRangeSelector value={rangeSelection} onChange={setRangeSelection} />
											<DownloadTuningSelector value={tuning} onChange={setTuning} />
										</>
									)}
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
										disabled={
											!manifest ||
											progress.status === "downloading" ||
											(downloadMode !== DownloadMode.ManifestOnly &&
												(getSegmentRangeError(rangeSelection) !== null || getDownloadTuningError(tuning) !== null))
										}
										onClick={async () => {
											setAnalysisError(null);
											const sanitizedManifest = sanitizeUri(manifest);
											try {
												const { data: manifestStr } = await axios.get(sanitizedManifest);
												await analyzeManifest({
													manifestStr,
													manifestUrl: sanitizedManifest,
													mode: downloadMode,
													range: rangeSelection,
													tuning,
												});
											} catch (err) {
												const reason = err instanceof Error ? err.message : "unknown error";
												setAnalysisError(`Failed to analyze ${sanitizedManifest}: ${reason}`);
												setProgress({ status: "idle", current: 0, total: 0, startTime: null });
											}
										}}
									>
										{progress.status === "downloading" ? "Downloading..." : "Load Manifest"}
									</Button>
								</TabsContent>

								<TabsContent value="upload" className="space-y-3">
									<Button className="w-full" variant="outline" onClick={() => openManifestPicker()}>
										Select manifest file
									</Button>
									{manifestFileName && (
										<p className="text-sm text-muted-foreground">
											Selected: {manifestFileName}
											{detectedType !== "unknown" && <> ({detectedType.toUpperCase()})</>}
										</p>
									)}

									<div className="space-y-2">
										<Label htmlFor={uploadBaseUrlId}>Base URL (optional)</Label>
										<Input
											id={uploadBaseUrlId}
											type="text"
											placeholder="https://example.com/path/"
											value={uploadBaseUrl}
											onChange={(e) => setUploadBaseUrl(e.target.value)}
										/>
									</div>

									<div className="space-y-2">
										<Label>Download mode</Label>
										<ToggleGroup
											type="single"
											variant="outline"
											value={effectiveUploadMode}
											onValueChange={(value) => {
												if (value) setUploadDownloadMode(value as DownloadMode);
											}}
											disabled={!hasUploadBaseUrl}
											className="w-full"
										>
											{Object.values(DownloadMode).map((mode) => (
												<ToggleGroupItem key={mode} value={mode} className="flex-1">
													{DownloadModeInfo[mode].label}
												</ToggleGroupItem>
											))}
										</ToggleGroup>
										<div className="min-h-20 space-y-1">
											<p className="text-sm text-muted-foreground">{DownloadModeInfo[effectiveUploadMode].long}</p>
											{!hasUploadBaseUrl && (
												<p className="text-sm text-muted-foreground">
													Without a base URL, analysis is locked to manifest-only mode because relative segment URLs
													cannot be resolved.
												</p>
											)}
											{detectedType === "hls" && (
												<p className="text-sm text-muted-foreground">
													Uploaded HLS master playlists reference child playlists that require network access; provide a
													base URL for full analysis.
												</p>
											)}
										</div>
									</div>

									{effectiveUploadMode !== DownloadMode.ManifestOnly && (
										<>
											<SegmentRangeSelector
												value={uploadRangeSelection}
												onChange={setUploadRangeSelection}
												disabled={!hasUploadBaseUrl}
											/>
											<DownloadTuningSelector value={tuning} onChange={setTuning} disabled={!hasUploadBaseUrl} />
										</>
									)}

									<Button
										className="w-full"
										disabled={
											!manifestFileContent ||
											progress.status === "downloading" ||
											(effectiveUploadMode !== DownloadMode.ManifestOnly &&
												(getSegmentRangeError(uploadRangeSelection) !== null ||
													getDownloadTuningError(tuning) !== null))
										}
										onClick={async () => {
											setAnalysisError(null);
											if (!manifestFileContent) return;
											const type = detectManifestType(manifestFileContent, manifestFileName ?? undefined);
											if (type === "unknown") {
												setAnalysisError("Unrecognized manifest format. Upload a DASH (.mpd) or HLS (.m3u8) manifest.");
												return;
											}
											const trimmedBase = sanitizeUri(uploadBaseUrl.trim());
											const hasBase = trimmedBase.length > 0;
											let manifestUrl: string;
											let baseUrl: string | undefined;
											if (type === "dash") {
												manifestUrl = buildSyntheticUrl("dash");
												baseUrl = hasBase ? trimmedBase : undefined;
											} else {
												manifestUrl = hasBase ? trimmedBase : buildSyntheticUrl("hls");
												baseUrl = undefined;
											}
											const mode = hasBase ? uploadDownloadMode : DownloadMode.ManifestOnly;
											try {
												await analyzeManifest({
													manifestStr: manifestFileContent,
													manifestUrl,
													baseUrl,
													mode,
													range: uploadRangeSelection,
													tuning,
												});
											} catch (err) {
												setAnalysisError(
													err instanceof Error ? err.message : "Failed to analyze the uploaded manifest.",
												);
												setProgress({ status: "idle", current: 0, total: 0, startTime: null });
											}
										}}
									>
										{progress.status === "downloading" ? "Analyzing..." : "Analyze Uploaded Manifest"}
									</Button>
								</TabsContent>
							</Tabs>

							{/* Shared progress display during download */}
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

					{/* Secondary flow: load a previously saved report */}
					<Card>
						<CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="font-medium leading-none">Load Report File</p>
								<p className="text-sm text-muted-foreground">Open a previously saved .cmdt report</p>
							</div>
							<Button variant="outline" className="w-full sm:w-auto" onClick={() => openFilePicker()}>
								Select report file
							</Button>
						</CardContent>
					</Card>
				</div>

				{analysisError && (
					<Alert variant="destructive">
						<AlertTitle>Analysis failed</AlertTitle>
						<AlertDescription>{analysisError}</AlertDescription>
					</Alert>
				)}

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
