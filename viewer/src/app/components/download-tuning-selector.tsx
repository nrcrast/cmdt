"use client";

import { DEFAULT_CONCURRENCY } from "cmdt-shared";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form state for the download tuning knobs. Numeric fields are kept as raw
 * strings so the inputs stay controlled and can be empty mid-edit; an empty
 * field means "use the engine default" and is resolved to `undefined`.
 */
export type DownloadTuning = {
	concurrency: string;
	retries: string;
};

export const defaultDownloadTuning: DownloadTuning = {
	concurrency: "",
	retries: "0",
};

function parseCount(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "") {
		return undefined;
	}
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * Validates the tuning inputs, returning a human-readable error when a field is
 * set to an invalid value (so the caller can block analysis), or null otherwise.
 */
export function getDownloadTuningError(tuning: DownloadTuning): string | null {
	if (tuning.concurrency.trim() !== "") {
		const concurrency = parseCount(tuning.concurrency);
		if (concurrency === undefined || concurrency < 1) {
			return "Max parallel downloads must be a positive whole number.";
		}
	}
	if (tuning.retries.trim() !== "") {
		const retries = parseCount(tuning.retries);
		if (retries === undefined || retries < 0) {
			return "Retries must be zero or a positive whole number.";
		}
	}
	return null;
}

export type ResolvedDownloadTuning = {
	concurrency?: number;
	numRetries?: number;
};

/**
 * Resolves the tuning form state into the numeric options the downloader
 * understands. Empty fields resolve to `undefined` so the engine defaults apply.
 */
export function resolveDownloadTuning(tuning: DownloadTuning): ResolvedDownloadTuning {
	return {
		concurrency: parseCount(tuning.concurrency),
		numRetries: parseCount(tuning.retries),
	};
}

type DownloadTuningSelectorProps = {
	value: DownloadTuning;
	onChange: (value: DownloadTuning) => void;
	disabled?: boolean;
};

/**
 * Advanced download controls: how many segments to fetch in parallel and how
 * many times to retry a failed segment. Presentational only — conversion to the
 * numeric downloader options happens in {@link resolveDownloadTuning}.
 */
export function DownloadTuningSelector({ value, onChange, disabled }: DownloadTuningSelectorProps) {
	const concurrencyId = useId();
	const retriesId = useId();
	const error = getDownloadTuningError(value);

	return (
		<div className="space-y-2">
			<Label>Download tuning</Label>
			<div className="flex gap-3">
				<div className="flex-1 space-y-1">
					<Label htmlFor={concurrencyId} className="text-xs text-muted-foreground">
						Max parallel downloads
					</Label>
					<Input
						id={concurrencyId}
						type="number"
						min={1}
						step={1}
						inputMode="numeric"
						placeholder={String(DEFAULT_CONCURRENCY)}
						value={value.concurrency}
						disabled={disabled}
						onChange={(e) => onChange({ ...value, concurrency: e.target.value })}
					/>
				</div>
				<div className="flex-1 space-y-1">
					<Label htmlFor={retriesId} className="text-xs text-muted-foreground">
						Retries per segment
					</Label>
					<Input
						id={retriesId}
						type="number"
						min={0}
						step={1}
						inputMode="numeric"
						placeholder="0"
						value={value.retries}
						disabled={disabled}
						onChange={(e) => onChange({ ...value, retries: e.target.value })}
					/>
				</div>
			</div>

			<div className="min-h-5">
				{error ? (
					<p className="text-sm text-destructive">{error}</p>
				) : (
					<p className="text-sm text-muted-foreground">
						Higher concurrency downloads faster but puts more load on the origin; retries re-attempt a segment fetch
						that fails.
					</p>
				)}
			</div>
		</div>
	);
}
