import { SCTE35 } from "scte35";
import {
	type Manifest,
	type ManifestParser,
	MediaType,
	type ParseResult,
	type Representation,
	UniqueRepresentationMap,
} from "../../manifest.js";
import { getCommonEntries } from "../../utils/array-utils.js";
import { getLogger } from "../../utils/logger.js";
import { wrapUrl } from "../../utils/url.js";
import { HlsParser } from "./hls-parser.js";
import { type ExtXMedia, type ExtXStreamInf, HlsMediaType } from "./types.js";

export class HlsManifest implements ManifestParser {
	private logger = getLogger();
	private scteParser: SCTE35;
	constructor() {
		this.scteParser = new SCTE35();
	}
	public async parse(manifest: string, manifestUrl: string, _baseUrl?: string): Promise<ParseResult> {
		const parser = new HlsParser();
		const master = await parser.parseMasterPlaylist(manifest, manifestUrl);

		const commonManifest: Manifest = {
			url: wrapUrl(manifestUrl),
			isLive: false,
			video: new UniqueRepresentationMap(),
			audio: new UniqueRepresentationMap(),
			images: new UniqueRepresentationMap(),
			text: new UniqueRepresentationMap(),
			scte35: Array.from(master.scte35Markers.values()).map((rawScte) => {
				return {
					presentationTimeS: rawScte.presentationTimeS,
					data: rawScte.markerString.startsWith("0x")
						? this.scteParser.parseFromHex(rawScte.markerString)
						: this.scteParser.parseFromB64(rawScte.markerString),
				};
			}),
			captionStreamToLanguage: {},
			periods: [],
			contentProtection: [],
			raw: manifest,
		};

		for (const rendition of master.mediaTags) {
			if (rendition.playlist) {
				if (rendition.type === "VIDEO") {
					commonManifest.video.add(this.getRepresentationFromMedia(rendition, master.streamInfTags));
				} else if (rendition.type === "AUDIO") {
					commonManifest.audio.add(this.getRepresentationFromMedia(rendition, master.streamInfTags));
				} else if (rendition.type === "SUBTITLES") {
					commonManifest.text.add(this.getRepresentationFromMedia(rendition, master.streamInfTags));
				}
			}
			if (rendition.type === "CLOSED-CAPTIONS") {
				commonManifest.captionStreamToLanguage[this.getShortformCaptionStream(rendition)] =
					rendition.language ?? rendition.name;
			}
		}

		const uniqueVariantPlaylists: Set<string> = new Set();

		for (const variant of master.streamInfTags) {
			if (variant.uri && variant.playlist) {
				if (!uniqueVariantPlaylists.has(variant.uri)) {
					uniqueVariantPlaylists.add(variant.uri);
				} else {
					this.logger.info(`Already parsed child playlist ${variant.uri}`);
					continue;
				}
				commonManifest.video.add(this.getRepresentationFromVariant(variant, master.mediaTags));
			}
		}

		for (const variant of master.imageStreamInfTags) {
			if (!variant.playlist?.imageLayout) {
				this.logger.warn(`Image stream ${variant.uri} does not have image layout information`);
				continue;
			}
			commonManifest.images.add({
				bandwidth: variant.bandwidth,
				id: `${variant.bandwidth}`,
				type: MediaType.Image,
				segments: variant.playlist?.segments ?? [],
				imageCols: variant.playlist?.imageLayout.cols,
				imageRows: variant.playlist?.imageLayout.rows,
				width: variant.resolution?.width,
				height: variant.resolution?.height,
				hasCaptions: {
					cea608: false,
					cea708: false,
				},
			});
		}

		let childPlaylists = master.childPlaylists.map((playlist) => {
			return {
				name: new URL(playlist.uri).pathname,
				content: playlist.data,
			};
		});

		const splitEntries = childPlaylists.map((p) => p.name.slice(1).split("/"));
		const commonPrefixIndex = getCommonEntries(splitEntries);
		if (commonPrefixIndex >= 0) {
			childPlaylists = childPlaylists.map((p, i) => {
				return {
					name: splitEntries[i]?.slice(commonPrefixIndex + 1).join("/") ?? p.name.slice(1),
					content: p.content,
				};
			});
		}

		// A media playlist is a complete (VOD) playlist only if it carries
		// `#EXT-X-ENDLIST`; a live stream's playlists omit it. Treat the stream as
		// live if any hydrated, segment-bearing playlist lacks the end marker.
		commonManifest.isLive = [...master.streamInfTags, ...master.mediaTags, ...master.imageStreamInfTags].some(
			(playlist) => (playlist.playlist?.segments.length ?? 0) > 0 && playlist.playlist?.endList === false,
		);

		return {
			manifest: commonManifest,
			artifacts: [
				{
					name: "master.m3u8",
					content: manifest,
				},
				...childPlaylists,
			],
		};
	}

	private isCea608(instreamId: string): boolean {
		return instreamId.startsWith("CC");
	}

	private mediaTypeFromHlsMediaType(mediaType: HlsMediaType): MediaType {
		switch (mediaType) {
			case HlsMediaType.AUDIO:
				return MediaType.Audio;
			case HlsMediaType.VIDEO:
				return MediaType.Video;
			case HlsMediaType.SUBTITLES:
			case HlsMediaType.CLOSED_CAPTIONS:
				return MediaType.Text;
		}
	}

	private getRepresentationFromVariant(variant: ExtXStreamInf, mediaTags: Array<ExtXMedia>): Representation {
		const id = `${variant?.codecs?.join(",").replaceAll(",", "-")}-${variant?.bandwidth}`;
		const captions = mediaTags.filter((media) => media.groupId === variant.closedCaptions);
		const isCea608 = captions.some((caption) => caption.instreamId && this.isCea608(caption.instreamId));

		const representation: Representation = {
			bandwidth: variant?.bandwidth,
			width: variant?.resolution?.width,
			height: variant?.resolution?.height,
			codecs: variant?.codecs?.join(","),
			id,
			type: MediaType.Video,
			hasCaptions: {
				cea608: isCea608,
				cea708: !isCea608,
			},
			segments: variant.playlist?.segments ?? [],
		};
		return representation;
	}

	private getRepresentationFromMedia(media: ExtXMedia, variants: Array<ExtXStreamInf>): Representation {
		// Find codecs for this media
		let variant: ExtXStreamInf | undefined;
		if (media.type === HlsMediaType.AUDIO) {
			variant = variants.find((variant) => variant.audio === media.groupId);
		} else if (media.type === HlsMediaType.VIDEO) {
			variant = variants.find((variant) => variant.video === media.groupId);
		}

		let id = `${variant?.codecs?.join(",").replaceAll(",", "-")}-${variant?.bandwidth}`;
		if (variant?.resolution) {
			id += `-${variant.resolution.width}x${variant.resolution.height}`;
		}
		if (media.type === HlsMediaType.SUBTITLES) {
			id = `text-${media.language}`;
		}
		const representation: Representation = {
			bandwidth: variant?.bandwidth,
			width: variant?.resolution?.width,
			height: variant?.resolution?.height,
			codecs: variant?.codecs?.join(","),
			id,
			type: this.mediaTypeFromHlsMediaType(media.type),
			hasCaptions: {
				cea608: false,
				cea708: false,
			},
			segments: media.playlist?.segments ?? [],
		};
		return representation;
	}

	private getShortformCaptionStream(rendition: ExtXMedia): string {
		if (rendition.type !== "CLOSED-CAPTIONS" || rendition.instreamId === undefined) {
			throw new Error("Invalid caption stream");
		}
		if (!this.isCea608(rendition.instreamId)) {
			return `svc${rendition.instreamId.split("SERVICE")[1]}`;
		} else {
			return rendition.instreamId.toLocaleLowerCase();
		}
	}
}
