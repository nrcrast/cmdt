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
