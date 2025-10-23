import url from "node:url";

export function wrapUrl(uri: string, origin?: string | URL): URL {
	if (uri.startsWith("http")) {
		return new URL(uri);
	}
	if (typeof origin === "string") {
		if (origin.startsWith("http")) {
			return new URL(uri, origin);
		}
	} else if (origin?.href?.startsWith("http")) {
		return new URL(uri, origin);
	}
	return url.pathToFileURL(uri);
}
