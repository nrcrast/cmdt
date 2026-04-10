import type { Representation as RawRepresentation } from "dash-ts";

export function buildSegmentUrlFromTemplate(
	baseUrl: string,
	segmentNumber: number,
	representation: RawRepresentation,
	time: number,
	uriTemplate: string,
): URL {
	const widthStr = uriTemplate.match(/\$Number%?0?([0-9]*)d?\$/)?.[1];
	const width = widthStr ? Number.parseInt(widthStr, 10) : 0;
	const paddedNumber = segmentNumber.toString().padStart(width, "0");
	if (baseUrl.endsWith("/")) {
		baseUrl = baseUrl.slice(0, -1);
	}
	let url = uriTemplate.startsWith("http")
		? uriTemplate.replace(/\$Number%?0?[0-9]*d?\$/, paddedNumber)
		: `${baseUrl}/${uriTemplate.replace(/\$Number%?0?[0-9]*d?\$/, paddedNumber)}`;
	url = url.replace(/\$RepresentationID\$/, representation.id);
	url = url.replace(/\$Bandwidth\$/, representation.bandwidth.toString());
	url = url.replace(/\$Time\$/, time.toString());
	return new URL(url);
}
