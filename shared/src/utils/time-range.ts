import type { Manifest, Representation } from "../manifest.js";
import { secondsToMilliseconds } from "./time-utils.js";

/**
 * An absolute slice of the presentation timeline, expressed in milliseconds.
 * The segment downloader only understands absolute times, so any relative
 * selection (e.g. "the latest N seconds") must be resolved to this shape first.
 */
export type AbsoluteTimeRange = {
	/** Inclusive start of the window, in milliseconds on the presentation timeline. */
	start: number;
	/** End of the window, in milliseconds. When omitted, the stream's live edge is used. */
	end?: number;
};

function maxSegmentEndMs(representations: Array<Representation>): number {
	let end = 0;
	for (const representation of representations) {
		for (const segment of representation.segments) {
			const segmentEnd = segment.startTime + segment.duration;
			if (segmentEnd > end) {
				end = segmentEnd;
			}
		}
	}
	return end;
}

/**
 * Computes the presentation-timeline live edge in milliseconds: the greatest
 * segment end time in the manifest. Video representations anchor the timeline
 * and define the edge; audio/image/text are only consulted as a fallback for
 * video-less (e.g. audio-only) manifests.
 */
export function getLiveEdgeMs(manifest: Manifest): number {
	const video = manifest.video.toArray();
	if (video.length > 0) {
		return maxSegmentEndMs(video);
	}
	return maxSegmentEndMs([...manifest.audio.toArray(), ...manifest.images.toArray(), ...manifest.text.toArray()]);
}

/**
 * Builds an absolute download range from user-facing seconds. Leaving
 * `endSeconds` undefined downloads through to the stream's live edge.
 */
export function secondsToTimeRange(startSeconds: number, endSeconds?: number): AbsoluteTimeRange {
	return {
		start: secondsToMilliseconds(startSeconds),
		end: endSeconds === undefined ? undefined : secondsToMilliseconds(endSeconds),
	};
}

/**
 * Converts a "latest N seconds from the live edge" window into an absolute
 * range. The downloader deals only in absolute presentation times, so the
 * relative window is resolved against the manifest's live edge here. The end is
 * left open so the downloader fetches through to the live edge.
 */
export function latestWindowToTimeRange(manifest: Manifest, windowSeconds: number): AbsoluteTimeRange {
	const liveEdgeMs = getLiveEdgeMs(manifest);
	const start = Math.max(0, liveEdgeMs - secondsToMilliseconds(windowSeconds));
	return { start };
}
