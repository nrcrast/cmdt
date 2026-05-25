// biome-ignore-all lint/style/noNonNullAssertion: Typescript's handling of map has/get is insufficient
import type { HydratablePlaylist } from "./hydratable-playlist.js";
import {
	ExtXImageStreamInf,
	ExtXMedia,
	ExtXStreamInf,
	type HlsMediaType,
	type MasterPlaylist,
	type SpecialUsageId,
	type VideoRange,
} from "./types.js";
import { parseAttributes, parseBooleanAttribute } from "./utils.js";

export class HlsParser {
	public async parseMasterPlaylist(playlist: string, uri: string): Promise<MasterPlaylist> {
		const lines = playlist.split("\n").map((line: string) => line.trim());
		const masterPlaylist: MasterPlaylist = {
			mediaTags: [],
			imageStreamInfTags: [],
			streamInfTags: [],
			childPlaylists: [],
			scte35Markers: new Map(),
		};

		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i]!;
			let hydratablePlaylist: HydratablePlaylist | undefined;
			if (line.startsWith("#EXT-X-STREAM-INF")) {
				const playlist = this.parseStreamInf(lines, line, i, uri);
				hydratablePlaylist = playlist;
				await playlist.hydratePlaylist();
				masterPlaylist.streamInfTags.push(playlist);
			}
			if (line.startsWith("#EXT-X-IMAGE-STREAM-INF")) {
				const playlist = this.parseImageStreamInf(line, uri);
				hydratablePlaylist = playlist;
				await playlist.hydratePlaylist();
				masterPlaylist.imageStreamInfTags.push(playlist);
			}
			if (line.startsWith("#EXT-X-MEDIA")) {
				const playlist = this.parseMedia(line, uri);
				hydratablePlaylist = playlist;
				await hydratablePlaylist.hydratePlaylist();
				masterPlaylist.mediaTags.push(playlist);
			}
			const rawManifest = hydratablePlaylist?.getRawManifest();
			if (hydratablePlaylist?.uri && rawManifest) {
				masterPlaylist.childPlaylists.push({
					uri: hydratablePlaylist.uri,
					data: rawManifest,
				});
			}
			for (const scteMarker of hydratablePlaylist?.playlist?.scte35Markers ?? []) {
				const id = `${scteMarker.presentationTimeS} - ${scteMarker.markerString}`;
				masterPlaylist.scte35Markers.set(id, scteMarker);
			}
		}
		return masterPlaylist;
	}

	private parseImageStreamInf(line: string, masterUri: string): ExtXImageStreamInf {
		const attributes = parseAttributes(line.substring(line.indexOf(":") + 1));
		const uri = URL.parse(attributes.get("URI")!, masterUri)!.href;
		const streamInf = new ExtXImageStreamInf(uri);
		if (!attributes.has("BANDWIDTH")) {
			throw new Error("ImageStreamInf tag missing required attribute BANDWIDTH");
		}
		if (!attributes.has("RESOLUTION")) {
			throw new Error("ImageStreamInf tag missing required attribute RESOLUTION");
		}

		const [width, height] = attributes
			.get("RESOLUTION")!
			.split("x")
			.map((val) => Number.parseInt(val, 10));
		if (!width || !height) {
			throw new Error("Invalid resolution");
		}
		streamInf.resolution = {
			width,
			height,
		};

		streamInf.bandwidth = Number.parseInt(attributes.get("BANDWIDTH")!, 10);
		return streamInf;
	}

	private parseStreamInf(lines: Array<string>, line: string, index: number, masterUri: string): ExtXStreamInf {
		const attributes = parseAttributes(line.substring(line.indexOf(":") + 1));
		const uri = URL.parse(lines[index + 1]!, masterUri)!.href;

		if (!attributes.has("BANDWIDTH")) {
			throw new Error("StreamInf tag missing required attribute BANDWIDTH");
		}

		const bandwidth = Number.parseInt(attributes.get("BANDWIDTH")!, 10);
		const streamInf = new ExtXStreamInf(uri, bandwidth);

		if (attributes.has("AVERAGE-BANDWIDTH")) {
			streamInf.averageBandwidth = Number.parseInt(attributes.get("AVERAGE-BANDWIDTH")!, 10);
		}

		if (attributes.has("SCORE")) {
			streamInf.score = Number.parseFloat(attributes.get("SCORE")!);
		}

		if (attributes.has("CODECS")) {
			streamInf.codecs = attributes.get("CODECS")!.split(",");
		}

		if (attributes.has("SUPPLEMENTAL-CODECS")) {
			streamInf.supplementalCodecs = attributes.get("SUPPLEMENTAL-CODECS")!.split(",");
		}

		if (attributes.has("RESOLUTION")) {
			const [width, height] = attributes
				.get("RESOLUTION")!
				.split("x")
				.map((val) => Number.parseInt(val, 10));
			if (!width || !height) {
				throw new Error("Invalid resolution");
			}
			streamInf.resolution = {
				width,
				height,
			};
		}

		if (attributes.has("FRAME-RATE")) {
			streamInf.frameRate = Number.parseFloat(attributes.get("FRAME-RATE")!);
		}

		if (attributes.has("HDCP-LEVEL")) {
			streamInf.hdcpLevel = attributes.get("HDCP-LEVEL")!;
		}

		if (attributes.has("ALLOWED-CPC")) {
			streamInf.allowedCpc = attributes.get("ALLOWED-CPC")!.split(",");
		}

		if (attributes.has("VIDEO-RANGE")) {
			const videoRange: string = attributes.get("VIDEO-RANGE")!;
			if (videoRange !== "SDR" && videoRange !== "PQ" && videoRange !== "HLG") {
				throw new Error("Invalid video range");
			}
			streamInf.videoRange = attributes.get("VIDEO-RANGE")! as VideoRange;
		}

		if (attributes.has("STABLE-VARIANT-ID")) {
			streamInf.stableVariantId = attributes.get("STABLE-VARIANT-ID")!;
		}

		if (attributes.has("AUDIO")) {
			streamInf.audio = attributes.get("AUDIO")!;
		}

		if (attributes.has("VIDEO")) {
			streamInf.video = attributes.get("VIDEO")!;
		}

		if (attributes.has("SUBTITLES")) {
			streamInf.subtitles = attributes.get("SUBTITLES")!;
		}

		if (attributes.has("CLOSED-CAPTIONS")) {
			streamInf.closedCaptions = attributes.get("CLOSED-CAPTIONS")!;
		}

		return streamInf;
	}
	private parseMedia(line: string, masterUri: string): ExtXMedia {
		const attributes = parseAttributes(line.substring(line.indexOf(":") + 1));

		if (!attributes.has("TYPE")) {
			throw new Error("Media tag missing required attribute TYPE");
		}
		const type = attributes.get("TYPE")!;
		if (type !== "AUDIO" && type !== "VIDEO" && type !== "SUBTITLES" && type !== "CLOSED-CAPTIONS") {
			throw new Error("Invalid media type");
		}

		let uri: string | undefined;

		if (attributes.has("URI")) {
			uri = attributes.get("URI")!;
			uri = URL.parse(uri, masterUri)!.href;
		}

		const media = new ExtXMedia(type as HlsMediaType, attributes.get("NAME")!, uri);

		if (!attributes.has("GROUP-ID")) {
			throw new Error("Media tag missing required attribute GROUP-ID");
		}
		media.groupId = attributes.get("GROUP-ID")!;

		if (attributes.has("LANGUAGE")) {
			media.language = attributes.get("LANGUAGE")!;
		}

		if (attributes.has("ASSOC-LANGUAGE")) {
			media.assocLanguage = attributes.get("ASSOC-LANGUAGE")!;
		}

		if (!attributes.has("NAME")) {
			throw new Error("Media tag missing required attribute NAME");
		}

		if (attributes.has("DEFAULT")) {
			media.default = parseBooleanAttribute(attributes.get("DEFAULT")!);
		}

		if (attributes.has("AUTOSELECT")) {
			media.autoselect = parseBooleanAttribute(attributes.get("AUTOSELECT")!);
		}

		if (attributes.has("FORCED")) {
			media.forced = parseBooleanAttribute(attributes.get("FORCED")!);
		}

		if (attributes.has("INSTREAM-ID")) {
			media.instreamId = attributes.get("INSTREAM-ID")!;
		}

		if (attributes.has("CHARACTERISTICS")) {
			media.characteristics = attributes.get("CHARACTERISTICS")!.split(",");
		}

		if (attributes.has("BIT-DEPTH")) {
			media.bitDepth = Number.parseInt(attributes.get("BIT-DEPTH")!, 10);
		}

		if (attributes.has("SAMPLE-RATE")) {
			media.sampleRate = Number.parseInt(attributes.get("SAMPLE-RATE")!, 10);
		}

		if (attributes.has("CHANNELS")) {
			const channels = attributes.get("CHANNELS")!.split("/");
			if (!channels[0] || channels[0].length === 0) {
				throw new Error("Invalid channel count");
			}
			let specialUsageIds: Set<SpecialUsageId> | undefined;
			if (channels[2]) {
				const splitSpecialUsageIds = channels[2].split(",");
				if (splitSpecialUsageIds.some((id) => id !== "BINAURAL" && id !== "IMMERSIVE" && id !== "DOWNMIX")) {
					throw new Error("Invalid special usage id");
				}
				specialUsageIds = new Set(splitSpecialUsageIds as Array<SpecialUsageId>);
			}
			media.channels = {
				count: Number.parseInt(channels[0], 10),
				audioCoding: channels[1] ? channels[1].split(",") : undefined,
				specialUsageIds,
			};
		}

		return media;
	}
}
