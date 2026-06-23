import type { Emsg } from "cmdt-shared";
import { describe, expect, it } from "vitest";
import { emsgDurationMs, emsgPresentationTimeMs } from "./emsg";

function makeEmsg(overrides: Partial<Emsg> = {}): Emsg {
	return {
		id: 1,
		eventDuration: 0,
		timescale: 1000,
		schemeIdUri: "urn:test",
		value: "",
		messageData: "",
		...overrides,
	};
}

describe("emsgPresentationTimeMs", () => {
	it("converts a v1 absolute presentationTime using the timescale", () => {
		const emsg = makeEmsg({ timescale: 90000, presentationTime: 90000 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 5000 })).toBe(1000);
	});

	it("removes the presentation time offset so v1 events align with the segment timeline", () => {
		// Raw media time (presentationTime/timescale) is 1000s; the segment's raw time is
		// 1000s but its presentation startTime is 100s, i.e. a 900s PTO that must be removed.
		const emsg = makeEmsg({ timescale: 1000, presentationTime: 1_000_000 });
		const segment = { startTime: 100_000, rawSegmentTime: 1_000_000 };
		expect(emsgPresentationTimeMs(emsg, segment)).toBe(100_000);
	});

	it("does not adjust v1 events when the segment has no rawSegmentTime", () => {
		const emsg = makeEmsg({ timescale: 1000, presentationTime: 2000 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 500 })).toBe(2000);
	});

	it("prefers presentationTime over presentationTimeDelta when both are present", () => {
		const emsg = makeEmsg({ timescale: 1000, presentationTime: 2000, presentationTimeDelta: 500 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 10000 })).toBe(2000);
	});

	it("adds a v0 presentationTimeDelta to the segment start", () => {
		const emsg = makeEmsg({ timescale: 1000, presentationTimeDelta: 1500 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 4000 })).toBe(5500);
	});

	it("converts a v0 delta with a non-1000 timescale", () => {
		const emsg = makeEmsg({ timescale: 90000, presentationTimeDelta: 45000 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 1000 })).toBe(1500);
	});

	it("falls back to the segment start when timescale is zero", () => {
		const emsg = makeEmsg({ timescale: 0, presentationTime: 90000 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 7000 })).toBe(7000);
	});

	it("falls back to the segment start when neither time field is present", () => {
		const emsg = makeEmsg({ timescale: 1000 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 3000 })).toBe(3000);
	});

	it("treats a presentationTime of zero as a valid absolute time", () => {
		const emsg = makeEmsg({ timescale: 1000, presentationTime: 0 });
		expect(emsgPresentationTimeMs(emsg, { startTime: 8000 })).toBe(0);
	});
});

describe("emsgDurationMs", () => {
	it("converts eventDuration using the timescale", () => {
		const emsg = makeEmsg({ timescale: 90000, eventDuration: 180000 });
		expect(emsgDurationMs(emsg)).toBe(2000);
	});

	it("returns 0 for a zero-length event", () => {
		const emsg = makeEmsg({ timescale: 1000, eventDuration: 0 });
		expect(emsgDurationMs(emsg)).toBe(0);
	});

	it("returns null for the 0xFFFFFFFF unknown-duration sentinel", () => {
		const emsg = makeEmsg({ timescale: 48000, eventDuration: 0xffffffff });
		expect(emsgDurationMs(emsg)).toBeNull();
	});

	it("returns null when timescale is zero", () => {
		const emsg = makeEmsg({ timescale: 0, eventDuration: 1000 });
		expect(emsgDurationMs(emsg)).toBeNull();
	});

	it("returns null when eventDuration is non-finite", () => {
		const emsg = makeEmsg({ timescale: 1000, eventDuration: Number.NaN });
		expect(emsgDurationMs(emsg)).toBeNull();
	});
});
