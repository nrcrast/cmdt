/**
 * Format a time in seconds to mm:ss.ms format
 * @param seconds - Time in seconds (e.g., 125.75)
 * @returns Formatted string (e.g., "02:05.750")
 */
export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

/**
 * Format a time given in milliseconds to a labeled, unit-bearing string in seconds.
 * Shared time convention for the viewer (e.g. segment, gap, cue, and event times).
 * @param ms - Time in milliseconds (e.g., 125750)
 * @returns Formatted string (e.g., "125.750s"), or "N/A" when the value is missing/invalid
 */
export function formatTimeMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) {
		return "N/A";
	}
	return `${(ms / 1000).toFixed(3)}s`;
}

/**
 * Format a time given in seconds using the shared time convention.
 * Convenience wrapper around {@link formatTimeMs} for call sites whose values are in seconds.
 * @param seconds - Time in seconds (e.g., 125.75)
 * @returns Formatted string (e.g., "125.750s"), or "N/A" when the value is missing/invalid
 */
export function formatTimeSeconds(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
		return "N/A";
	}
	return formatTimeMs(seconds * 1000);
}

/**
 * Format a bandwidth in bits per second as Mbps or kbps.
 * @param bps - Bandwidth in bits per second (e.g., 4_500_000)
 * @returns Formatted string (e.g., "4.50 Mbps" or "750 kbps"), or "N/A" when missing/invalid
 */
export function formatBandwidth(bps: number | null | undefined): string {
	if (bps === null || bps === undefined || !Number.isFinite(bps)) {
		return "N/A";
	}
	if (Math.abs(bps) >= 1_000_000) {
		return `${(bps / 1_000_000).toFixed(2)} Mbps`;
	}
	return `${Math.round(bps / 1000)} kbps`;
}
