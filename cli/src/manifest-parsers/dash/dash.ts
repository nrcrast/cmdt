import {
	getMediaTypeFromMimeType,
	type ImageRepresentation,
	type Manifest,
	type ManifestParser,
	MediaType,
	type Period as ParsedPeriod,
	type Representation,
	type Segment,
	UniqueRepresentationMap,
} from "cmdt-shared";
import {
	type AdaptationSet,
	type ContentType,
	getRawDashManifest,
	type MPD,
	type Period,
	type Representation as RawRepresentation,
	type SegmentTemplate,
} from "dash-ts";
import { deepmergeCustom } from "deepmerge-ts";
import type winston from "winston";
import { getInstance as getLogger } from "../../logger.js";
import getStreamAndLanguages from "../../utils/cea/getStreamAndLanguages.js";
import { CeaSchemeUri } from "../../utils/manifest/types.js";
import { secondsToMilliseconds } from "../../utils/time-utils.js";
import { wrapUrl } from "../../utils/url.js";

export class DashManifest implements ManifestParser {
	private logger: winston.Logger;
	private manifest: Manifest;
	constructor() {
		this.logger = getLogger();
		this.manifest = {
			url: wrapUrl("http://localhost"), // Placeholder
			video: new UniqueRepresentationMap(),
			audio: new UniqueRepresentationMap(),
			images: new UniqueRepresentationMap(),
			periods: [],
			captionStreamToLanguage: {},
		};
	}
	public async parse(manifest: string, manifestUrl: string): Promise<Manifest> {
		const mpd = await getRawDashManifest(manifest);
		this.manifest.url = wrapUrl(manifestUrl);
		this.manifest = this.parseRawManifest(mpd);
		return this.manifest;
	}

	private parseRawManifest(mpd: MPD): Manifest {
		for (const period of mpd.periods) {
			this.processPeriod(period);
		}

		return this.manifest;
	}

	private contentTypeToMediaType(contentType: ContentType): MediaType {
		switch (contentType) {
			case "video":
				return MediaType.Video;
			case "audio":
				return MediaType.Audio;
			case "image":
				return MediaType.Image;
			case "text":
				return MediaType.Text;
			case "application":
			case "font":
				return MediaType.Video;
		}
	}

	private guessMediaTypeFromCodecs(codecs: string): MediaType {
		if (codecs.includes("avc1") || codecs.includes("hev1") || codecs.includes("hvc1")) {
			return MediaType.Video;
		}
		if (codecs.includes("mp4a") || codecs.includes("ac-3") || codecs.includes("ec-3")) {
			return MediaType.Audio;
		}
		return MediaType.Video;
	}

	private getMediaTypeFromRepresentation(representation: RawRepresentation): MediaType {
		let mediaType: MediaType;
		const codecs = representation.codecs ?? representation.adaptationSet.codecs;
		const mimeType = representation.mimeType ?? representation.adaptationSet.mimeType;
		if (mimeType) {
			mediaType = getMediaTypeFromMimeType(mimeType);
		} else if (representation.adaptationSet.contentType) {
			mediaType = this.contentTypeToMediaType(representation.adaptationSet.contentType);
		} else if (codecs) {
			mediaType = this.guessMediaTypeFromCodecs(codecs);
		} else {
			this.logger.warn(`Could not determine media type for representation ${representation.id}`);
			mediaType = MediaType.Unknown;
		}
		return mediaType;
	}

	private buildSegmentUrlFromTemplate(
		baseUrl: string,
		segmentNumber: number,
		representation: RawRepresentation,
		uriTemplate: string,
	): string {
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
		return url;
	}

	private getBaseUrl(representation: RawRepresentation): string {
		let baseUrls: Array<string> = [];

		if (representation.adaptationSet.period.manifest.baseUrl?.[0]) {
			baseUrls.push(representation.adaptationSet.period.manifest.baseUrl[0].url);
		}

		if (representation.adaptationSet.period.baseUrl?.[0]) {
			baseUrls.push(representation.adaptationSet.period.baseUrl[0].url);
		}

		if (representation.adaptationSet.baseUrl?.[0]) {
			baseUrls.push(representation.adaptationSet.baseUrl[0].url);
		}

		if (representation.baseUrl?.[0]) {
			baseUrls.push(representation.baseUrl[0].url);
		}

		const firstAbsolute = baseUrls.findIndex((url) => url.startsWith("http"));

		if (firstAbsolute >= 0) {
			baseUrls = baseUrls.slice(firstAbsolute);
		} else {
			baseUrls = [this.manifest.url.href, ...baseUrls];
		}

		let absoluteBase = wrapUrl(this.manifest.url.href);
		for (const baseUrl of baseUrls) {
			if (baseUrl.startsWith("http")) {
				absoluteBase = wrapUrl(baseUrl);
			} else {
				absoluteBase = wrapUrl(baseUrl, absoluteBase);
			}
		}
		return absoluteBase.href;
	}

	private getSegmentsFromSegmentTemplate(
		representation: RawRepresentation,
		segmentTemplate: SegmentTemplate,
	): Array<Segment> {
		const segments: Array<Segment> = [];

		let n = segmentTemplate.startNumber ?? 1;
		const periodStart = representation.adaptationSet.period.start ?? 0;
		const baseUrl = this.getBaseUrl(representation);
		const timescale = segmentTemplate.timescale ?? 1;

		if (!segmentTemplate.media) {
			this.logger.warn(`No media template for representation ${representation.id}`);
			return [];
		}

		for (const timeline of segmentTemplate.segmentTimeline?.s ?? []) {
			const numSegments = timeline.r + 1;
			const tWithOffset = (timeline.t ?? 0) - (segmentTemplate.presentationTimeOffset ?? 0);
			const unscaledDuration = timeline.d ?? 0;
			for (let i = 0; i < numSegments; i++) {
				segments.push({
					initSegmentUrl: segmentTemplate.initialization
						? this.buildSegmentUrlFromTemplate(baseUrl, n, representation, segmentTemplate.initialization)
						: undefined,
					duration: secondsToMilliseconds(unscaledDuration / timescale),
					startTime: secondsToMilliseconds(periodStart + (tWithOffset + i * unscaledDuration) / timescale),
					url: this.buildSegmentUrlFromTemplate(baseUrl, n, representation, segmentTemplate.media),
					rawSegmentTime: secondsToMilliseconds(((timeline.t ?? 0) + i * unscaledDuration) / timescale),
				});
				n++;
			}
		}

		return segments;
	}

	private getSegmentsFromRepresentation(representation: RawRepresentation): Array<Segment> {
		if (representation.segmentTemplate || representation.adaptationSet.segmentTemplate) {
			const mergedTemplate = deepmergeCustom({ mergeArrays: false })(
				representation.adaptationSet.segmentTemplate ?? {},
				representation.segmentTemplate,
			) as SegmentTemplate;
			return this.getSegmentsFromSegmentTemplate(representation, mergedTemplate);
		}
		this.logger.warn(`No segment template for representation ${representation.id}`);
		return [];
	}

	private parseVideoRepresentation(representation: RawRepresentation): void {
		const hasCea608 = representation.adaptationSet.accessibility?.some((e) => e.schemeIdUri === CeaSchemeUri.CEA608);
		const hasCea708 = representation.adaptationSet.accessibility?.some((e) => e.schemeIdUri === CeaSchemeUri.CEA708);
		const videoRepresentation: Representation = {
			id: representation.id,
			width: representation.width ?? representation.adaptationSet.width,
			height: representation.height ?? representation.adaptationSet.height,
			bandwidth: representation.bandwidth,
			type: MediaType.Video,
			hasCaptions: {
				cea608: hasCea608 ?? false,
				cea708: hasCea708 ?? false,
			},
			codecs: representation.codecs ?? representation.adaptationSet.codecs,
			language: representation.adaptationSet.lang,
			segments: this.getSegmentsFromRepresentation(representation),
		};
		if (hasCea608 || hasCea708) {
			if (!representation.adaptationSet.accessibility) {
				throw new Error(`No accessibility information found for adaptation set ${representation.adaptationSet.id}`);
			}
			for (const accessibility of representation.adaptationSet.accessibility) {
				const info = getStreamAndLanguages(accessibility);
				for (const entry of info) {
					this.manifest.captionStreamToLanguage[entry[0]] = entry[1];
				}
			}
		}
		this.manifest.video.add(videoRepresentation);
	}

	private parseAudioRepresentation(representation: RawRepresentation): void {
		const audioRepresentation: Representation = {
			id: representation.id,
			width: representation.width ?? representation.adaptationSet.width,
			height: representation.height ?? representation.adaptationSet.height,
			bandwidth: representation.bandwidth,
			type: MediaType.Audio,
			hasCaptions: {
				cea608: false,
				cea708: false,
			},
			codecs: representation.codecs ?? representation.adaptationSet.codecs,
			language: representation.adaptationSet.lang,
			segments: this.getSegmentsFromRepresentation(representation),
		};
		this.manifest.audio.add(audioRepresentation);
	}

	private parseImageRepresentation(representation: RawRepresentation): void {
		let dashThumbProperty = representation.essentialProperty?.find(
			(e) => e.schemeIdUri === "http://dashif.org/guidelines/thumbnail_tile",
		);
		if (!dashThumbProperty) {
			dashThumbProperty = representation.adaptationSet.essentialProperty?.find(
				(e) => e.schemeIdUri === "http://dashif.org/guidelines/thumbnail_tile",
			);
		}

		if (!dashThumbProperty?.value) {
			this.logger.warn(`No thumbnail tile information found for representation ${representation.id}`);
			return;
		}

		const [cols, rows] = dashThumbProperty.value.split("x").map((val) => Number.parseInt(val, 10));

		if (!cols || !rows) {
			this.logger.warn(`Invalid thumbnail tile information found for representation ${representation.id}`);
			return;
		}

		const imageRepresentation: ImageRepresentation = {
			id: representation.id,
			width: representation.width ?? representation.adaptationSet.width,
			height: representation.height ?? representation.adaptationSet.height,
			bandwidth: representation.bandwidth,
			type: MediaType.Image,
			hasCaptions: {
				cea608: false,
				cea708: false,
			},
			codecs: representation.codecs ?? representation.adaptationSet.codecs,
			language: representation.adaptationSet.lang,
			imageRows: rows,
			imageCols: cols,
			segments: this.getSegmentsFromRepresentation(representation),
		};
		this.manifest.images.add(imageRepresentation);
	}

	private parseRepresentation(representation: RawRepresentation): void {
		const mediaType: MediaType = this.getMediaTypeFromRepresentation(representation);
		switch (mediaType) {
			case MediaType.Video:
				this.parseVideoRepresentation(representation);
				break;
			case MediaType.Audio:
				this.parseAudioRepresentation(representation);
				break;
			case MediaType.Image:
				this.parseImageRepresentation(representation);
				break;
			// case MediaType.Text:
			// 	this.parseTextRepresentation(representation);
			// 	break;
		}
	}

	private processAdaptationSet(adaptationSet: AdaptationSet): void {
		for (const representation of adaptationSet.representation ?? []) {
			this.parseRepresentation(representation);
		}
	}

	private processPeriod(period: Period): void {
		// store index of current segments so we can only use the newly added segments
		const i = this.manifest.video.entries().next().value?.[1].segments.length ?? 0;

		for (const adaptationSet of period.adaptationSet ?? []) {
			this.processAdaptationSet(adaptationSet);
		}

		const segments = this.manifest.video.entries().next().value?.[1].segments ?? [];

		const p = <ParsedPeriod>{};
		p.id = period.id;
		p.start = period.start ?? 0;
		p.baseUrl = period.baseUrl?.map((u) => u.url) ?? [];
		p.startString = period.startString;
		p.segmentsAvailable = segments.length;
		p.duration = segments.slice(i).reduce((sum, seg) => sum + seg.duration, 0) / 1000;
		p.end = p.start + p.duration;
		if (this.manifest.periods.length > 0) {
			const previousPeriod = this.manifest.periods[this.manifest.periods.length - 1];
			if (previousPeriod) {
				p.startPrevEnd = p.start - previousPeriod.end < 0.1;
				p.periodOverlap = previousPeriod.end - p.start > 0.1;
			}
		}

		this.manifest.periods.push(p);
	}
}
