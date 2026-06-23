import type { Emsg, Segment } from "cmdt-shared";

/** Sentinel value (0xFFFFFFFF) used by emsg boxes to mean "unknown" event duration. */
const UNKNOWN_EVENT_DURATION = 0xffffffff;

/** Minimal segment context needed to place an emsg on the presentation timeline. */
type EmsgSegment = Pick<Segment, "startTime" | "rawSegmentTime">;

/**
 * Presentation-timeline time of an EMSG event in milliseconds, using its timescale.
 *
 * Version 1 emsg boxes carry an absolute `presentationTime` (in timescale units) on
 * the raw media timeline. The segment timeline the viewer renders uses
 * `Segment.startTime`, which has the presentation time offset (PTO) removed, so the
 * raw emsg time is realigned by subtracting that PTO (derived from the containing
 * segment's `rawSegmentTime - startTime`). Version 0 emsg boxes carry a
 * `presentationTimeDelta` relative to the segment's earliest presentation time, so
 * the value is simply the (already PTO-adjusted) segment start plus that delta.
 *
 * @param emsg - The parsed emsg box.
 * @param segment - The segment the emsg was found in (start + raw time).
 * @returns Presentation-timeline time in milliseconds.
 */
export function emsgPresentationTimeMs(emsg: Emsg, segment: EmsgSegment): number {
	const startMs = segment.startTime;
	if (emsg.timescale > 0) {
		if (emsg.presentationTime != null) {
			const rawMs = (emsg.presentationTime / emsg.timescale) * 1000;
			const ptoMs = segment.rawSegmentTime != null ? segment.rawSegmentTime - startMs : 0;
			return rawMs - ptoMs;
		}
		if (emsg.presentationTimeDelta != null) {
			return startMs + (emsg.presentationTimeDelta / emsg.timescale) * 1000;
		}
	}
	return startMs;
}

/**
 * Event duration of an EMSG in milliseconds, derived from its timescale.
 *
 * @param emsg - The parsed emsg box.
 * @returns Duration in milliseconds, or null when unknown/indeterminate.
 */
export function emsgDurationMs(emsg: Emsg): number | null {
	if (emsg.eventDuration === UNKNOWN_EVENT_DURATION) {
		return null;
	}
	if (emsg.timescale > 0 && Number.isFinite(emsg.eventDuration)) {
		return (emsg.eventDuration / emsg.timescale) * 1000;
	}
	return null;
}
