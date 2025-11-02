import { Factory } from "fishery";
import type { Segment } from "cmdt-shared";

export const segmentFactory = Factory.define<Segment>(({ sequence }) => {
	return {
		startTime: sequence * 1000,
		duration: 1000,
		url: new URL(`https://example.com/segment-${sequence}.mp4`),
		rawSegmentTime: sequence * 1000,
		initSegmentUrl: new URL("https://example.com/init.mp4"),
	};
});
