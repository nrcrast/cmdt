import type { RawReport as Report } from "cmdt-shared";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatTimeMs } from "@/lib/format";

/**
 * Extract a URL string from a value that may be a URL instance, a serialized
 * `{ href }` object, or a plain string (reports loaded from a file are serialized).
 */
function getUrlString(url: unknown): string {
	if (!url) return "";
	if (typeof url === "string") return url;
	if (typeof url === "object" && "href" in url) return (url as { href: string }).href;
	return "";
}

function countGaps(gaps: Report["gaps"]): number {
	let count = 0;
	for (const reps of Object.values(gaps)) {
		for (const entries of Object.values(reps)) {
			count += entries.length;
		}
	}
	return count;
}

function countMissingCaptions(missingCues: Report["missingCues"]): number {
	let count = 0;
	for (const cues of Object.values(missingCues)) {
		for (const reps of Object.values(cues)) {
			count += reps.length;
		}
	}
	return count;
}

function totalDurationMs(manifest: Report["manifest"]): number | null {
	let max = 0;
	let found = false;
	for (const reps of [manifest.video, manifest.audio, manifest.text, manifest.images]) {
		for (const rep of reps) {
			const last = rep.segments[rep.segments.length - 1];
			if (last) {
				found = true;
				max = Math.max(max, last.startTime + last.duration);
			}
		}
	}
	return found ? max : null;
}

function Stat(props: { label: string; value: string | number }) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-muted-foreground">{props.label}</span>
			<span className="text-lg font-semibold tabular-nums">{props.value}</span>
		</div>
	);
}

function ProblemStat(props: { label: string; count: number }) {
	const hasProblem = props.count > 0;
	return (
		<div className="flex items-center gap-2">
			<Badge variant={hasProblem ? "destructive" : "secondary"} className="tabular-nums">
				{props.count}
			</Badge>
			<span className={hasProblem ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{props.label}</span>
		</div>
	);
}

export default function ReportSummary({ report }: { report: Report }) {
	const { manifest } = report;
	const url = getUrlString(manifest.url);
	const duration = totalDurationMs(manifest);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Stream Summary</CardTitle>
				{url ? (
					<div className="flex min-w-0 items-center gap-1">
						<span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={url}>
							{url}
						</span>
						<CopyButton value={url} className="shrink-0" />
					</div>
				) : (
					<span className="text-xs text-muted-foreground">No stream URL available</span>
				)}
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-x-8 gap-y-3">
					<Stat label="Periods" value={manifest.periods.length} />
					<Stat label="Video Renditions" value={manifest.video.length} />
					<Stat label="Audio Renditions" value={manifest.audio.length} />
					<Stat label="Text Renditions" value={manifest.text.length} />
					<Stat label="Image Renditions" value={manifest.images.length} />
					<Stat label="Duration" value={duration === null ? "N/A" : formatTimeMs(duration)} />
				</div>
				<div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4">
					<ProblemStat label="Gaps" count={countGaps(report.gaps)} />
					<ProblemStat label="Decode Time Mismatches" count={report.decodeTimeMismatches.length} />
					<ProblemStat label="Duration Mismatches" count={report.durationMismatches.length} />
					<ProblemStat label="Missing Captions" count={countMissingCaptions(report.missingCues)} />
					<ProblemStat label="DRM Mismatches" count={report.mismatchedContentProtection.length} />
				</div>
			</CardContent>
		</Card>
	);
}
