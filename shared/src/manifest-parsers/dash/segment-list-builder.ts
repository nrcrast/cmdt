import type { Representation as RawRepresentation, SegmentTemplate } from "dash-ts";
import type { Segment } from "../../manifest.js";
import { MemoryCachedChunk } from "../../manifest.js";
import { secondsToMilliseconds } from "../../utils/time-utils.js";
import { buildSegmentUrlFromTemplate } from "./utils.js";

function getSegmentsFromSegmentTimeline(
	segmentTemplate: SegmentTemplate,
	baseUrl: string,
	representation: RawRepresentation,
) {
	let n = segmentTemplate.startNumber ?? 1;
	const timescale = segmentTemplate.timescale ?? 1;
	const segments: Array<Segment> = [];
	const periodStart = representation.adaptationSet.period.start ?? 0;
	let calculatedT = 0;
	if (!segmentTemplate.media) {
		throw new Error(`No media template for representation ${representation.id}`);
	}
	for (const entry of segmentTemplate.segmentTimeline?.s ?? []) {
		let numSegments = entry.r + 1;
		if (entry.d && entry.r < 0 && representation.adaptationSet.period.duration) {
			const durationInSeconds = entry.d / timescale;
			numSegments = Math.ceil(representation.adaptationSet.period.duration / durationInSeconds);
		}
		calculatedT = entry.t ?? calculatedT ?? 0;
		const tWithOffset = calculatedT - (segmentTemplate.presentationTimeOffset ?? 0);
		const unscaledDuration = entry.d ?? 0;
		for (let i = 0; i < numSegments; i++) {
			const url = buildSegmentUrlFromTemplate(baseUrl, n, representation, calculatedT, segmentTemplate.media);
			segments.push({
				initSegment: segmentTemplate.initialization
					? new MemoryCachedChunk(
							buildSegmentUrlFromTemplate(baseUrl, n, representation, calculatedT, segmentTemplate.initialization),
						)
					: undefined,
				duration: secondsToMilliseconds(unscaledDuration / timescale),
				startTime: secondsToMilliseconds(periodStart + (tWithOffset + i * unscaledDuration) / timescale),
				url,
				rawSegmentTime: secondsToMilliseconds(((entry.t ?? 0) + i * unscaledDuration) / timescale),
				media: new MemoryCachedChunk(url),
			});
			calculatedT += unscaledDuration;
			n++;
		}
	}
	return segments;
}

function getSegmentsWithoutTimeline(
	segmentTemplate: SegmentTemplate,
	baseUrl: string,
	periodDuration: number,
	representation: RawRepresentation,
) {
	const timescale = segmentTemplate.timescale ?? 1;
	const periodStart = representation.adaptationSet.period.start ?? 0;
	const durationSeconds = (segmentTemplate.duration ?? 0) / timescale;
	const segments: Array<Segment> = [];
	let n = segmentTemplate.startNumber ?? 1;
	if (!segmentTemplate.duration) {
		throw new Error(`No duration for representation ${representation.id}`);
	}
	if (!segmentTemplate.media) {
		throw new Error(`No media template for representation ${representation.id}`);
	}
	const numSegments = Math.ceil(periodDuration / (segmentTemplate.duration / timescale));
	const unscaledDuration = segmentTemplate.duration;
	const tWithOffset = 0 - (segmentTemplate.presentationTimeOffset ?? 0);
	let calculatedT = 0;

	for (let i = 0; i < numSegments; i++) {
		const url = buildSegmentUrlFromTemplate(baseUrl, n, representation, calculatedT, segmentTemplate.media);
		segments.push({
			initSegment: segmentTemplate.initialization
				? new MemoryCachedChunk(
						buildSegmentUrlFromTemplate(baseUrl, n, representation, calculatedT, segmentTemplate.initialization),
					)
				: undefined,
			duration: secondsToMilliseconds(durationSeconds),
			startTime: secondsToMilliseconds(periodStart + (tWithOffset + i * unscaledDuration) / timescale),
			url,
			rawSegmentTime: secondsToMilliseconds((i * unscaledDuration) / timescale),
			media: new MemoryCachedChunk(url),
		});
		calculatedT += unscaledDuration;
		n++;
	}
	return segments;
}

export function getSegmentsFromSegmentTemplate(
	baseUrl: string,
	periodDuration: number,
	representation: RawRepresentation,
	segmentTemplate: SegmentTemplate,
): Array<Segment> {
	if (!segmentTemplate.segmentTimeline && segmentTemplate.duration !== undefined) {
		return getSegmentsWithoutTimeline(segmentTemplate, baseUrl, periodDuration, representation);
	}

	return getSegmentsFromSegmentTimeline(segmentTemplate, baseUrl, representation);
}
