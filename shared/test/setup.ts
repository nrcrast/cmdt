import axios from "axios";
import type { Mock } from "vitest";
import { vi } from "vitest";

/**
 * Global test safety net: fail loudly on any real network access.
 *
 * Unit tests must be hermetic — every manifest and segment is served from a
 * fixture under `test/manifests/`. Two transports can reach the network from
 * `shared`:
 *   - `axios`         — HLS child-playlist fetches in the manifest parsers
 *   - global `fetch`  — segment/init byte downloads in `MemoryCachedChunk`
 *
 * Both are stubbed to throw by default so an accidental live request (a missing
 * mock, or a new code path that downloads during parsing) fails with a clear
 * message instead of silently hitting a CDN. A test that legitimately needs one
 * opts in by supplying its own implementation, e.g.
 * `vi.mocked(axios.get).mockImplementation(...)` or `vi.stubGlobal("fetch", ...)`.
 */

// Vitest hoists this above the imports, so the `axios` imported above is the auto-mock.
vi.mock("axios");

const throwOnNetwork = (caller: string) => () => {
	throw new Error(
		`${caller} attempted real network access in a test. Tests must be hermetic — ` +
			'mock the request (e.g. vi.mocked(axios.get).mockImplementation(...) or vi.stubGlobal("fetch", ...)).',
	);
};

// Default every axios entry point to throw; tests override the ones they use.
const stubAxios = (fn: unknown, name: string) => {
	if (fn && typeof (fn as Mock).mockImplementation === "function") {
		(fn as Mock).mockImplementation(throwOnNetwork(name));
	}
};
stubAxios(axios, "axios()");
stubAxios(axios.request, "axios.request");
stubAxios(axios.get, "axios.get");
stubAxios(axios.delete, "axios.delete");
stubAxios(axios.head, "axios.head");
stubAxios(axios.options, "axios.options");
stubAxios(axios.post, "axios.post");
stubAxios(axios.put, "axios.put");
stubAxios(axios.patch, "axios.patch");

// Any un-mocked global fetch throws with a clear message.
vi.stubGlobal("fetch", vi.fn(throwOnNetwork("fetch")));
