import type { Region } from "../cue.js";

const createEmptyRegion = (): Region => {
	return {
		width: 100,
		height: 16,
		regionAnchorX: 0,
		regionAnchorY: 0,
		viewportanchorX: 0,
		viewportanchorY: 0,
		align: "center",
		scroll: "up",
		style: null,
	};
};

export default createEmptyRegion;
