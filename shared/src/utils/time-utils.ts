export function secondsToMilliseconds(seconds: number): number {
	return Math.floor(seconds * 1000);
}

export function millisecondsToSeconds(milliseconds: number): number {
	return milliseconds / 1000;
}
