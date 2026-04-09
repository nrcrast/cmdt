// biome-ignore-all lint/style/noNonNullAssertion: Typescript's handling of map has/get is insufficient

import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import type { Segment } from "cmdt-shared";
import { getOpts } from "../../cli-opts.js";
import { getInstance as getLogger } from "../../logger.js";
import { secondsToMilliseconds } from "../../utils/time-utils.js";
import { wrapUrl } from "../../utils/url.js";
import type { MediaPlaylist } from "./types.js";
import { parseAttributes, parseBooleanAttribute } from "./utils.js";
import { FilesystemDownloadableChunk } from "../../downloader.js";
export abstract class HydratablePlaylist {
	public playlist?: MediaPlaylist;
	private currentStartTime = 0;
	private currentInitSegmentUri?: string;
	constructor(public uri?: string) {}
	public async hydratePlaylist(): Promise<void> {
		if (!this.uri) {
			return;
		}
		this.playlist = {
			targetDuration: 0,
			segments: [],
			mediaSequence: 0,
			discontinuitySequence: 0,
			playlistType: "VOD",
			iFramesOnly: false,
		};
		const { data } = await axios.get(this.uri);
		const opts = getOpts();
		const lastUriChunk = this.uri.split("/").pop() ?? "";
		const manifestPath = path.resolve(opts.output, lastUriChunk);
		getLogger().info(`Writing manifest to ${manifestPath}`);
		await fs.writeFile(manifestPath, data);
		const lines = data.split("\n").map((line: string) => line.trim());
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			if (line.startsWith("#EXT")) {
				this.parseTag(lines, line, i);
			}
		}
	}

	private parseTag(lines: Array<string>, line: string, index: number) {
		const firstColon = line.indexOf(":");
		const tagName = line.substring(0, firstColon >= 0 ? firstColon : undefined);
		const restOfLine = firstColon >= 0 ? line.substring(firstColon + 1) : "";
		if (!this.playlist) {
			throw new Error("Playlist not initialized");
		}
		switch (tagName) {
			case "#EXT-X-TARGETDURATION": {
				this.playlist.targetDuration = Number.parseInt(restOfLine, 10);
				break;
			}
			case "#EXT-X-MEDIA-SEQUENCE": {
				this.playlist.mediaSequence = Number.parseInt(restOfLine, 10);
				break;
			}
			case "#EXT-X-DISCONTINUITY-SEQUENCE": {
				this.playlist.discontinuitySequence = Number.parseInt(restOfLine, 10);
				break;
			}
			case "#EXT-X-PLAYLIST-TYPE": {
				if (restOfLine !== "EVENT" && restOfLine !== "VOD") {
					throw new Error("Invalid playlist type. MUST be 'EVENT' or 'VOD'");
				}
				this.playlist.playlistType = restOfLine as "EVENT" | "VOD";
				break;
			}
			case "#EXT-X-I-FRAMES-ONLY": {
				this.playlist.iFramesOnly = parseBooleanAttribute(restOfLine);
				break;
			}
			case "#EXT-X-TILES": {
				const attributes = parseAttributes(restOfLine);
				if (!attributes.has("LAYOUT")) {
					break;
				}
				if (this.playlist?.imageLayout) {
					break;
				}
				const [rows, cols] = attributes
					.get("LAYOUT")!
					.split("x")
					.map((val) => Number.parseInt(val, 10));
				this.playlist.imageLayout = {
					rows: rows!,
					cols: cols!,
				};
				break;
			}
			case "#EXTINF": {
				const segment = this.parseSegment(lines, restOfLine, index);
				this.playlist.segments.push(segment);
				this.currentStartTime += segment.duration;
				break;
			}
			case "#EXT-X-MAP": {
				const attributes = parseAttributes(restOfLine);
				this.currentInitSegmentUri = URL.parse(attributes.get("URI")!, this.uri)?.href;
				break;
			}
		}
	}
	private getUrl(destination: string, origin: string): string {
		if (destination.startsWith("http")) {
			return destination;
		}
		const url = wrapUrl(destination, origin);
		return url.href;
	}
	private parseSegment(lines: Array<string>, lineValue: string, index: number) {
		if (!this.uri) {
			throw new Error("URI not set");
		}
		const segmentUri = lines[index + 1];
		if (!segmentUri) {
			throw new Error("Invalid manifest. Expected URI.");
		}
		const [duration] = lineValue.split(",");
		if (!duration) {
			throw new Error("Invalid segment duration");
		}
		let url = "";
		url = this.getUrl(segmentUri, this.uri);
		const segment: Segment = {
			duration: secondsToMilliseconds(Number.parseFloat(duration)),
			startTime: secondsToMilliseconds(this.currentStartTime),
			url: new URL(url),
			initSegment: this.currentInitSegmentUri
				? new FilesystemDownloadableChunk(new URL(this.currentInitSegmentUri))
				: undefined,
			media: new FilesystemDownloadableChunk(new URL(url)),
		};
		return segment;
	}
}
