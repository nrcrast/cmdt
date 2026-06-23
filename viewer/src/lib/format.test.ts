import { describe, expect, it } from "vitest";
import { formatBandwidth, formatTime, formatTimeMs, formatTimeSeconds } from "./format";

describe("formatTime", () => {
	it("formats seconds as mm:ss.mmm", () => {
		expect(formatTime(125.75)).toBe("02:05.750");
	});

	it("zero-pads minutes and seconds", () => {
		expect(formatTime(5)).toBe("00:05.000");
	});
});

describe("formatTimeMs", () => {
	it("formats milliseconds as labeled seconds", () => {
		expect(formatTimeMs(125750)).toBe("125.750s");
	});

	it("formats zero", () => {
		expect(formatTimeMs(0)).toBe("0.000s");
	});

	it("rounds to three decimal places", () => {
		expect(formatTimeMs(1234.5678)).toBe("1.235s");
	});

	it("returns N/A for null/undefined/non-finite", () => {
		expect(formatTimeMs(null)).toBe("N/A");
		expect(formatTimeMs(undefined)).toBe("N/A");
		expect(formatTimeMs(Number.NaN)).toBe("N/A");
		expect(formatTimeMs(Number.POSITIVE_INFINITY)).toBe("N/A");
	});
});

describe("formatTimeSeconds", () => {
	it("formats seconds using the shared convention", () => {
		expect(formatTimeSeconds(125.75)).toBe("125.750s");
	});

	it("returns N/A for missing/invalid values", () => {
		expect(formatTimeSeconds(null)).toBe("N/A");
		expect(formatTimeSeconds(undefined)).toBe("N/A");
		expect(formatTimeSeconds(Number.NaN)).toBe("N/A");
	});
});

describe("formatBandwidth", () => {
	it("formats large values in Mbps with two decimals", () => {
		expect(formatBandwidth(4_500_000)).toBe("4.50 Mbps");
	});

	it("uses Mbps at exactly 1,000,000 bps", () => {
		expect(formatBandwidth(1_000_000)).toBe("1.00 Mbps");
	});

	it("formats smaller values in rounded kbps", () => {
		expect(formatBandwidth(750_000)).toBe("750 kbps");
		expect(formatBandwidth(128_000)).toBe("128 kbps");
	});

	it("returns N/A for missing/invalid values", () => {
		expect(formatBandwidth(null)).toBe("N/A");
		expect(formatBandwidth(undefined)).toBe("N/A");
		expect(formatBandwidth(Number.NaN)).toBe("N/A");
	});
});
