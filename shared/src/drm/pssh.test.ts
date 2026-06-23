import { describe, expect, it } from "vitest";
import { type PlayreadyData, PlayreadyHeaderType } from "./playready/playready.js";
import { PsshParser } from "./pssh.js";
import type { WidevineData } from "./widevine/widevine.js";

describe("Playready", () => {
	it("should read PSSH", async () => {
		const buf = Buffer.from(
			"AAADYnBzc2gAAAAAmgTweZhAQoarkuZb4IhflQAAA0JCAwAAAQABADgDPABXAFIATQBIAEUAQQBEAEUAUgAgAHgAbQBsAG4AcwA9ACIAaAB0AHQAcAA6AC8ALwBzAGMAaABlAG0AYQBzAC4AbQBpAGMAcgBvAHMAbwBmAHQALgBjAG8AbQAvAEQAUgBNAC8AMgAwADAANwAvADAAMwAvAFAAbABhAHkAUgBlAGEAZAB5AEgAZQBhAGQAZQByACIAIAB2AGUAcgBzAGkAbwBuAD0AIgA0AC4AMAAuADAALgAwACIAPgA8AEQAQQBUAEEAPgA8AFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwASwBFAFkATABFAE4APgAxADYAPAAvAEsARQBZAEwARQBOAD4APABBAEwARwBJAEQAPgBBAEUAUwBDAFQAUgA8AC8AQQBMAEcASQBEAD4APAAvAFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwATABBAF8AVQBSAEwAPgBoAHQAdABwADoALwAvAGwAaQBjAC4AcABlAGEAYwBvAGMAawB0AHYALgBjAG8AbQAvAFAAbABhAHkAUgBlAGEAZAB5AEwAaQBjAGUAbgBzAGUAcgAvAHIAaQBnAGgAdABzAG0AYQBuAGEAZwBlAHIALgBhAHMAbQB4ADwALwBMAEEAXwBVAFIATAA+ADwATABVAEkAXwBVAFIATAA+AGgAdAB0AHAAOgAvAC8AbABpAGMALgBwAGUAYQBjAG8AYwBrAHQAdgAuAGMAbwBtAC8AUABsAGEAeQBSAGUAYQBkAHkATABpAGMAZQBuAHMAZQByAC8AcgBpAGcAaAB0AHMAbQBhAG4AYQBnAGUAcgAuAGEAcwBtAHgAPAAvAEwAVQBJAF8AVQBSAEwAPgA8AEsASQBEAD4ASABnAFUAVwBBAEsAUQB6AE8AVQBtAHMATAA1AHQAbwBmAFgAeQBUAHgAdwA9AD0APAAvAEsASQBEAD4APABDAEgARQBDAEsAUwBVAE0APgBYAEwAagBPADAAZQBvACsATwBQAEkAPQA8AC8AQwBIAEUAQwBLAFMAVQBNAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA=",
			"base64",
		);
		const parser = new PsshParser();
		const psshData = parser.parse(buf) as PlayreadyData;
		expect(psshData).toBeDefined();
		expect(psshData?.type).toEqual("playready");
		expect(psshData?.playreadyHeader[0]?.type).toEqual(PlayreadyHeaderType.PRH);
	});
});

describe("Widevine", () => {
	it("should read PSSH", async () => {
		const buf = Buffer.from(
			"AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",
			"base64",
		);
		const parser = new PsshParser();
		const psshData = parser.parse(buf) as WidevineData;
		expect(psshData).toBeDefined();
		expect(psshData?.type).toEqual("widevine");
	});
	it("should read PSSH with a key ID that is not a valid RFC-4122 UUID", async () => {
		// Real PSSH whose KID (20079b7c-cdf3-fbc4-...) has non-standard version/variant
		// nibbles. uuid's validating stringify throws on it; the non-validating
		// formatter must parse it without aborting.
		const buf = Buffer.from("AAAAOHBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAABgSECAHm3zN8/vEYyXG09/DT2NI49yVmwY=", "base64");
		const parser = new PsshParser();
		const psshData = parser.parse(buf) as WidevineData;
		expect(psshData).toBeDefined();
		expect(psshData?.type).toEqual("widevine");
		expect(psshData?.widevinePsshData.keyIds).toContain("20079b7c-cdf3-fbc4-6325-c6d3dfc34f63");
	});
});
