

/**
 * Converts a URI string to a URL object, handling both absolute and relative URLs.
 * @param uri - The URI string to convert
 * @param origin - Optional origin URL (as string or URL object) to resolve relative URIs against
 * @returns A URL object representing the input URI
 */
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
	return new URL(uri);
}

/**
 * Extracts the file extension from a URL's pathname.
 * @param url - The URL object to extract the extension from
 * @returns The file extension (without the dot), or an empty string if no extension is found
 */
export function getExtensionFromUrl(url: URL): string {
	const lastSegment = url.pathname.split("/").pop();
	return lastSegment?.split(".").pop() ?? "";
}

/**
 * Determines if the URL points to a file (as opposed to a directory).
 * @param url - The URL object to check
 * @returns True if the URL points to a file, false otherwise
 */
export function isFileUrl(url: URL): boolean {
	return !!url.pathname.split("/").pop()?.includes(".");
}

/**
 * Returns the href of the URL without the file path.
 * @param url - The URL object to extract the href from
 * @returns The href of the URL without the file path
 */
export function getUrlFilePathHref(url: URL): string {
	return url.href.split("/").slice(0, -1).join("/");
}

/**
 * Returns the href of the URL without the file path.
 * @param url - The URL object to extract the href from
 * @returns The href of the URL without the file path
 */
export function getUrlFilePath(url: URL): string {
	let path = url.pathname.split("/").slice(0, -1).join("/");
	if (path.startsWith("/")) {
		path = path.substring(1);
	}
	return path;
}
