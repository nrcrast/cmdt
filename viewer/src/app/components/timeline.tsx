"use client";

import type { RawReport as Report, Representation, Segment } from "cmdt-shared";
import { scaleLinear } from "d3-scale";
import { pointer, select } from "d3-selection";
import { zoom as d3Zoom, type ZoomBehavior, type ZoomTransform, zoomIdentity } from "d3-zoom";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emsgPresentationTimeMs } from "@/lib/emsg";
import { formatTimeMs } from "@/lib/format";

type Interval = { startMs: number; endMs: number };
type RepLane = { id: string; type: string; runs: Interval[]; gaps: Interval[] };
type Marker = { ms: number; label: string };

const DEFAULT_GAP_EPSILON_MS = 1;
/** Selectable thresholds (ms) below which a discontinuity is not treated as a gap. */
const GAP_EPSILON_OPTIONS_MS = [0, 0.25, 0.5, 0.75, 1, 10, 50, 100, 250, 500, 1000];
const ZOOM_MIN = 1;
const ZOOM_MAX = 64;
const ZOOM_STEP = 1.5;

/** Merge consecutive segments into contiguous covered runs, recording gaps between them. */
function coverage(segments: Array<Segment>, gapEpsilonMs: number): { runs: Interval[]; gaps: Interval[] } {
	const segs = [...segments].sort((a, b) => a.startTime - b.startTime);
	const runs: Interval[] = [];
	const gaps: Interval[] = [];
	let runStart: number | null = null;
	let runEnd = 0;
	for (const s of segs) {
		const start = s.startTime;
		const end = s.startTime + s.duration;
		if (runStart === null) {
			runStart = start;
			runEnd = end;
		} else if (start > runEnd + gapEpsilonMs) {
			runs.push({ startMs: runStart, endMs: runEnd });
			gaps.push({ startMs: runEnd, endMs: start });
			runStart = start;
			runEnd = end;
		} else {
			runEnd = Math.max(runEnd, end);
		}
	}
	if (runStart !== null) runs.push({ startMs: runStart, endMs: runEnd });
	return { runs, gaps };
}

function buildLanes(manifest: Report["manifest"], gapEpsilonMs: number): RepLane[] {
	const lanes: RepLane[] = [];
	const groups: Array<[string, Array<Representation>]> = [
		["video", manifest.video],
		["audio", manifest.audio],
		["text", manifest.text],
	];
	for (const [type, reps] of groups) {
		for (const rep of reps) {
			if (!rep.segments.length) continue;
			const { runs, gaps } = coverage(rep.segments, gapEpsilonMs);
			lanes.push({ id: rep.id, type, runs, gaps });
		}
	}
	return lanes;
}

function collectMarkers(report: Report): { scte35: Marker[]; emsg: Marker[] } {
	const scte35: Marker[] = (report.manifest.scte35 ?? []).map((m) => ({
		ms: m.presentationTimeS * 1000,
		label: formatTimeMs(m.presentationTimeS * 1000),
	}));
	const emsg: Marker[] = [];
	for (const entry of Object.values(report.emsgs)) {
		for (const e of entry.emsgs) {
			const ms = emsgPresentationTimeMs(e, entry.segment);
			emsg.push({ ms, label: `${e.schemeIdUri}@${formatTimeMs(ms)}` });
		}
	}
	return { scte35, emsg };
}

export default function Timeline({ report }: { report: Report }) {
	const [gapEpsilonMs, setGapEpsilonMs] = useState(DEFAULT_GAP_EPSILON_MS);
	const [width, setWidth] = useState(0);
	const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
	const [hoverX, setHoverX] = useState<number | null>(null);
	const plotRef = useRef<HTMLDivElement>(null);
	const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);

	const { manifest } = report;
	const lanes = useMemo(() => buildLanes(manifest, gapEpsilonMs), [manifest, gapEpsilonMs]);
	const { scte35, emsg } = collectMarkers(report);

	const allMs = [
		...lanes.flatMap((l) => l.runs.flatMap((r) => [r.startMs, r.endMs])),
		...manifest.periods.map((p) => p.start * 1000),
		...manifest.periods.map((p) => p.end * 1000),
		...scte35.map((m) => m.ms),
		...emsg.map((m) => m.ms),
	].filter((n) => Number.isFinite(n));
	const hasData = allMs.length > 0;
	const minMs = hasData ? Math.min(...allMs) : 0;
	const maxMs = hasData ? Math.max(...allMs) : 1;

	// d3 linear scale mapping ms -> pixels across the measured plot width.
	const baseScale = useMemo(
		() =>
			scaleLinear()
				.domain([minMs, Math.max(minMs + 1, maxMs)])
				.range([0, Math.max(0, width)]),
		[minMs, maxMs, width],
	);
	// Apply the current zoom/pan transform to the base scale.
	const x = useMemo(() => transform.rescaleX(baseScale), [transform, baseScale]);

	// Measure the plot area so the scale maps onto actual pixels.
	useEffect(() => {
		const el = plotRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			setWidth(entries[0]?.contentRect.width ?? 0);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Wire up d3-zoom for wheel-zoom and drag-to-pan, constrained to the data range.
	useEffect(() => {
		const el = plotRef.current;
		if (!el || width === 0) return;
		const height = el.clientHeight;
		const behavior = d3Zoom<HTMLDivElement, unknown>()
			.scaleExtent([ZOOM_MIN, ZOOM_MAX])
			.extent([
				[0, 0],
				[width, height],
			])
			.translateExtent([
				[0, 0],
				[width, height],
			])
			.on("zoom", (event) => setTransform(event.transform));
		zoomRef.current = behavior;
		const selection = select(el);
		selection.call(behavior);
		selection
			.on("mousemove.crosshair", (event) => {
				const [mx] = pointer(event, el);
				setHoverX(mx >= 0 && mx <= width ? mx : null);
			})
			.on("mouseleave.crosshair", () => setHoverX(null));
		return () => {
			selection.on(".zoom", null).on(".crosshair", null);
			zoomRef.current = null;
		};
	}, [width]);

	const applyZoom = (factor: number) => {
		const el = plotRef.current;
		if (el && zoomRef.current) select(el).call(zoomRef.current.scaleBy, factor);
	};
	const fitToScreen = () => {
		const el = plotRef.current;
		if (el && zoomRef.current) select(el).call(zoomRef.current.transform, zoomIdentity);
	};

	if (!hasData) {
		return (
			<Alert>
				<AlertTitle>No Timeline Data</AlertTitle>
				<AlertDescription>This report has no segments, periods, or events to plot.</AlertDescription>
			</Alert>
		);
	}

	const tickCount = Math.max(2, Math.min(12, Math.round(width / 110)));
	const axisTicks: Marker[] = width > 0 ? x.ticks(tickCount).map((ms) => ({ ms, label: formatTimeMs(ms) })) : [];

	const atMinZoom = transform.k <= ZOOM_MIN + 1e-3;
	const atMaxZoom = transform.k >= ZOOM_MAX - 1e-3;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">Gap threshold</span>
					<Select value={String(gapEpsilonMs)} onValueChange={(v) => setGapEpsilonMs(Number(v))}>
						<SelectTrigger
							size="sm"
							className="h-7 w-24"
							title="Discontinuities shorter than this are not shown as gaps"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{GAP_EPSILON_OPTIONS_MS.map((ms) => (
								<SelectItem key={ms} value={String(ms)}>
									{ms} ms
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center gap-1">
					<span className="mr-1 text-xs tabular-nums text-muted-foreground">{transform.k.toFixed(1)}×</span>
					<Button
						variant="outline"
						size="icon"
						className="size-7"
						title="Zoom out"
						disabled={atMinZoom}
						onClick={() => applyZoom(1 / ZOOM_STEP)}
					>
						<ZoomOut className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-7"
						title="Zoom in"
						disabled={atMaxZoom}
						onClick={() => applyZoom(ZOOM_STEP)}
					>
						<ZoomIn className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-7"
						title="Fit to screen"
						disabled={atMinZoom}
						onClick={fitToScreen}
					>
						<Maximize2 className="size-4" />
					</Button>
				</div>
			</div>
			<div className="rounded-md border p-4">
				<div ref={plotRef} className="relative cursor-grab touch-none space-y-3 select-none active:cursor-grabbing">
					<div className="relative h-5">
						{axisTicks.map((t) => (
							<span
								key={`axis-${t.ms}`}
								className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
								style={{ left: `${x(t.ms)}px` }}
							>
								{t.label}
							</span>
						))}
					</div>

					<div>
						<div className="mb-1 text-xs font-medium text-muted-foreground">Periods ({manifest.periods.length})</div>
						<div className="relative h-6 overflow-hidden rounded bg-muted">
							{manifest.periods.map((p, i) => {
								const ms = p.start * 1000;
								return (
									<div
										key={`period-${p.id ?? ""}-${ms}`}
										className="absolute top-0 h-full border-l-2 border-foreground/50"
										style={{ left: `${x(ms)}px` }}
										title={`Period ${p.id ?? i + 1} @ ${formatTimeMs(ms)}`}
									/>
								);
							})}
						</div>
					</div>

					{lanes.map((lane) => (
						<div key={`${lane.type}-${lane.id}`}>
							<div className="mb-1 text-xs font-medium text-muted-foreground">
								{lane.type} · {lane.id}
							</div>
							<div className="relative h-6 overflow-hidden rounded bg-muted">
								{lane.runs.map((r) => (
									<div
										key={`run-${r.startMs}-${r.endMs}`}
										className="absolute top-0 h-full rounded bg-primary/70"
										style={{ left: `${x(r.startMs)}px`, width: `${Math.max(1, x(r.endMs) - x(r.startMs))}px` }}
										title={`${formatTimeMs(r.startMs)} – ${formatTimeMs(r.endMs)}`}
									/>
								))}
								{lane.gaps.map((g) => (
									<div
										key={`gap-${g.startMs}-${g.endMs}`}
										className="absolute top-0 h-full bg-destructive"
										style={{
											left: `${x(g.startMs)}px`,
											width: `${Math.max(2, x(g.endMs) - x(g.startMs))}px`,
										}}
										title={`Gap: ${formatTimeMs(g.startMs)} – ${formatTimeMs(g.endMs)}`}
									/>
								))}
							</div>
						</div>
					))}

					<MarkerLane label="SCTE-35" markers={scte35} x={x} className="bg-chart-4" />
					<MarkerLane label="EMSG" markers={emsg} x={x} className="bg-chart-5" />

					{hoverX !== null && (
						<>
							<div
								className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-foreground/40"
								style={{ left: `${hoverX}px` }}
							/>
							<div
								className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 rounded bg-foreground px-1 text-[10px] leading-tight text-background tabular-nums"
								style={{ left: `${hoverX}px` }}
							>
								{formatTimeMs(x.invert(hoverX))}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function MarkerLane(props: { label: string; markers: Marker[]; x: (ms: number) => number; className: string }) {
	return (
		<div>
			<div className="mb-1 text-xs font-medium text-muted-foreground">
				{props.label} ({props.markers.length})
			</div>
			<div className="relative h-6 overflow-hidden rounded bg-muted">
				{props.markers.map((m, i) => (
					<div
						key={`${props.label}-${m.ms}-${i}`}
						className={`absolute top-0 h-full w-0.5 ${props.className}`}
						style={{ left: `${props.x(m.ms)}px` }}
						title={m.label}
					/>
				))}
			</div>
		</div>
	);
}
