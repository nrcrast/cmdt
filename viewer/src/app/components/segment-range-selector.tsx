"use client";

import { type AbsoluteTimeRange, latestWindowToTimeRange, type Manifest, secondsToTimeRange } from "cmdt-shared";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Which slice of the stream to download.
 * - `all`: every segment (no range restriction).
 * - `absolute`: an explicit [start, end) window on the presentation timeline.
 * - `latest`: only the most recent N seconds before the live edge (live content).
 */
export type SegmentRangeMode = "all" | "absolute" | "latest";

/**
 * Form state for the range selector. Numeric fields are kept as raw strings so
 * the inputs stay controlled and can be empty mid-edit; they are parsed only
 * when the selection is resolved into an absolute range.
 */
export type SegmentRangeSelection = {
	mode: SegmentRangeMode;
	startSeconds: string;
	endSeconds: string;
	latestSeconds: string;
};

export const defaultSegmentRangeSelection: SegmentRangeSelection = {
	mode: "all",
	startSeconds: "",
	endSeconds: "",
	latestSeconds: "30",
};

function parseSeconds(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "") {
		return undefined;
	}
	const parsed = Number.parseFloat(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Validates a selection, returning a human-readable error when the inputs are
 * inconsistent (so the caller can block analysis), or null when it is usable.
 */
export function getSegmentRangeError(selection: SegmentRangeSelection): string | null {
	if (selection.mode === "absolute") {
		const start = parseSeconds(selection.startSeconds);
		const end = parseSeconds(selection.endSeconds);
		if (start !== undefined && start < 0) {
			return "Start time must be zero or greater.";
		}
		if (end !== undefined && end < 0) {
			return "End time must be zero or greater.";
		}
		if (start !== undefined && end !== undefined && start >= end) {
			return "Start time must be less than end time.";
		}
		return null;
	}
	if (selection.mode === "latest") {
		const seconds = parseSeconds(selection.latestSeconds);
		if (seconds === undefined || seconds <= 0) {
			return "Enter a positive number of seconds from the live edge.";
		}
		return null;
	}
	return null;
}

/**
 * Resolves a selection into the absolute (millisecond) range the downloader
 * understands, using the parsed manifest to anchor the live-edge window.
 * Returns undefined for the "entire stream" case or when inputs are empty.
 */
export function resolveSegmentRange(
	selection: SegmentRangeSelection,
	manifest: Manifest,
): AbsoluteTimeRange | undefined {
	if (selection.mode === "absolute") {
		const start = parseSeconds(selection.startSeconds);
		const end = parseSeconds(selection.endSeconds);
		if (start === undefined && end === undefined) {
			return undefined;
		}
		return secondsToTimeRange(start ?? 0, end);
	}
	if (selection.mode === "latest") {
		const seconds = parseSeconds(selection.latestSeconds);
		if (seconds === undefined || seconds <= 0) {
			return undefined;
		}
		return latestWindowToTimeRange(manifest, seconds);
	}
	return undefined;
}

const MODE_LABELS: Record<SegmentRangeMode, string> = {
	all: "Entire stream",
	absolute: "Absolute range",
	latest: "Latest from live edge",
};

type SegmentRangeSelectorProps = {
	value: SegmentRangeSelection;
	onChange: (value: SegmentRangeSelection) => void;
	disabled?: boolean;
};

/**
 * Lets the user restrict a download to a slice of the presentation timeline:
 * an absolute [start, end) window, or the latest N seconds from the live edge
 * (for live streams). Presentational only — conversion to an absolute range
 * happens in {@link resolveSegmentRange} once the manifest is parsed.
 */
export function SegmentRangeSelector({ value, onChange, disabled }: SegmentRangeSelectorProps) {
	const startId = useId();
	const endId = useId();
	const latestId = useId();
	const error = getSegmentRangeError(value);

	return (
		<div className="space-y-2">
			<Label>Segment range</Label>
			<ToggleGroup
				type="single"
				variant="outline"
				value={value.mode}
				onValueChange={(mode) => {
					if (mode) onChange({ ...value, mode: mode as SegmentRangeMode });
				}}
				disabled={disabled}
				className="w-full"
			>
				{(Object.keys(MODE_LABELS) as Array<SegmentRangeMode>).map((mode) => (
					<ToggleGroupItem key={mode} value={mode} className="flex-1">
						{MODE_LABELS[mode]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			{value.mode === "absolute" && (
				<div className="flex gap-3">
					<div className="flex-1 space-y-1">
						<Label htmlFor={startId} className="text-xs text-muted-foreground">
							Start (seconds)
						</Label>
						<Input
							id={startId}
							type="number"
							min={0}
							inputMode="decimal"
							placeholder="0"
							value={value.startSeconds}
							disabled={disabled}
							onChange={(e) => onChange({ ...value, startSeconds: e.target.value })}
						/>
					</div>
					<div className="flex-1 space-y-1">
						<Label htmlFor={endId} className="text-xs text-muted-foreground">
							End (seconds)
						</Label>
						<Input
							id={endId}
							type="number"
							min={0}
							inputMode="decimal"
							placeholder="end of stream"
							value={value.endSeconds}
							disabled={disabled}
							onChange={(e) => onChange({ ...value, endSeconds: e.target.value })}
						/>
					</div>
				</div>
			)}

			{value.mode === "latest" && (
				<div className="space-y-1">
					<Label htmlFor={latestId} className="text-xs text-muted-foreground">
						Seconds from live edge
					</Label>
					<Input
						id={latestId}
						type="number"
						min={0}
						inputMode="decimal"
						placeholder="30"
						value={value.latestSeconds}
						disabled={disabled}
						onChange={(e) => onChange({ ...value, latestSeconds: e.target.value })}
					/>
				</div>
			)}

			<div className="min-h-5">
				{error ? (
					<p className="text-sm text-destructive">{error}</p>
				) : (
					<p className="text-sm text-muted-foreground">
						{value.mode === "all" && "Download every segment in the manifest."}
						{value.mode === "absolute" &&
							"Download only segments overlapping the given window on the presentation timeline."}
						{value.mode === "latest" &&
							"Download only the most recent segments before the live edge. Best for live streams."}
					</p>
				)}
			</div>
		</div>
	);
}
