import {
	type AdaptationSet,
	type ContentProtection,
	type ContentType,
	type Descriptor,
	getRawDashManifest,
	type MPD,
	type Period,
	type Representation as RawRepresentation,
	type SegmentTemplate,
} from "dash-ts";
import { deepmergeCustom } from "deepmerge-ts";
import { type ILogObj, Logger } from "tslog";
import type { PlayreadyData } from "../../drm/playready/playready.js";
import { PsshParser } from "../../drm/pssh.js";
import type { WidevineData } from "../../drm/widevine/widevine.js";
import {
	DrmSystem,
	getMediaTypeFromMimeType,
	type ImageRepresentation,
	type Manifest,
	type ManifestParser,
	MediaType,
	type Period as ParsedPeriod,
	type Representation,
	type Segment,
	UniqueRepresentationMap,
} from "../../manifest.js";
import getStreamAndLanguages from "../../utils/cea/getStreamAndLanguages.js";
import { getDrmSystemFromSystemId } from "../../utils/drm.js";
import { CeaSchemeUri } from "../../utils/types.js";
import { getUrlFilePathHref, isFileUrl, wrapUrl } from "../../utils/url.js";
import { getSegmentsFromSegmentTemplate } from "./segment-list-builder.js";

export class DashManifest implements ManifestParser {
	private logger: Logger<ILogObj>;
	private manifest: Manifest;
	private baseUrl?: string;
	private dashManifest: MPD | undefined;
	constructor() {
		this.logger = new Logger();
		this.manifest = {
			url: wrapUrl("http://localhost"), // Placeholder
			video: new UniqueRepresentationMap(),
			audio: new UniqueRepresentationMap(),
			images: new UniqueRepresentationMap(),
			periods: [],
			contentProtection: [],
			captionStreamToLanguage: {},
			raw: "",
		};
	}

	private getContentProtectionId(contentProtection: ContentProtection): number {
		this.addContentProtection(contentProtection);
		return this.manifest.contentProtection.findIndex((e) => e.systemId === contentProtection.schemeIdUri);
	}

	private addContentProtection(contentProtection: ContentProtection) {
		const candidateContentProtection: Manifest["contentProtection"][0] = {
			systemId: contentProtection.schemeIdUri,
			type: getDrmSystemFromSystemId(contentProtection.schemeIdUri),
			pssh: contentProtection.widevine?.cencPssh ?? contentProtection.playready?.cencPssh,
			cencDefaultKid: contentProtection.cencDefaultKid,
		};

		const existing = this.manifest.contentProtection.find((e) => e.systemId === candidateContentProtection.systemId);
		if (existing) {
			return;
		}
		let parsedContentProtection: WidevineData | PlayreadyData | undefined;
		if (candidateContentProtection.pssh) {
			const psshAsBuffer = Uint8Array.from(atob(candidateContentProtection.pssh), (c) => c.charCodeAt(0));
			try {
				parsedContentProtection = new PsshParser().parse(new Uint8Array(psshAsBuffer));
			} catch (e) {
				this.logger.warn(`Failed to parse pssh: ${e}`);
			}
		}
		candidateContentProtection.parsedPssh = parsedContentProtection;

		this.manifest.contentProtection.push(candidateContentProtection);
	}

	public async parse(manifest: string, manifestUrl: string, baseUrl?: string): Promise<Manifest> {
		this.baseUrl = baseUrl;
		this.dashManifest = await getRawDashManifest(manifest);
		this.manifest.url = wrapUrl(manifestUrl);
		this.manifest.raw = manifest;
		this.manifest = this.parseRawManifest(this.dashManifest);
		if (this.dashManifest?.contentProtection) {
			for (const contentProtection of this.dashManifest.contentProtection) {
				this.addContentProtection(contentProtection);
			}
		}
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
			default:
				return MediaType.Unknown;
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

	private getBaseUrl(representation: RawRepresentation): string {
		let baseUrls: Array<string> = [
			representation.adaptationSet.period.manifest,
			representation.adaptationSet.period,
			representation.adaptationSet,
			representation,
		]
			.map((e) => e.baseUrl?.[0]?.url)
			.filter((e) => e) as Array<string>;

		let manifestHref = this.manifest.url.href;
		if (isFileUrl(this.manifest.url)) {
			manifestHref = getUrlFilePathHref(this.manifest.url);
		}

		const firstAbsolute = baseUrls.findIndex((url) => url.startsWith("http"));

		if (firstAbsolute >= 0) {
			baseUrls = baseUrls.slice(firstAbsolute);
		} else {
			if (manifestHref) {
				baseUrls = [manifestHref, ...baseUrls];
			}

			if (this.baseUrl) {
				baseUrls = [this.baseUrl, ...baseUrls];
			}
		}

		let absoluteBase = wrapUrl(manifestHref);
		for (const baseUrl of baseUrls) {
			if (baseUrl.startsWith("http")) {
				absoluteBase = wrapUrl(baseUrl);
			} else {
				absoluteBase = wrapUrl(baseUrl, absoluteBase);
			}
		}
		return absoluteBase.href;
	}

	private getPeriodDurationSeconds(period: Period): number | undefined {
		if (period.duration) {
			return period.duration;
		}
		const periodIndex = this.dashManifest?.periods.indexOf(period) ?? -1;
		let nextPeriod: Period | undefined;

		if (periodIndex >= 0) {
			nextPeriod = this.dashManifest?.periods[periodIndex + 1];
		}
		if (nextPeriod && period.start !== undefined && nextPeriod.start !== undefined) {
			return nextPeriod.start - period.start;
		}
		if (this.dashManifest?.periods.length === 1 && this.dashManifest.mediaPresentationDuration) {
			return this.dashManifest.mediaPresentationDuration;
		}
		return undefined;
	}

	private getSegmentsFromRepresentation(representation: RawRepresentation): Array<Segment> {
		let segments: Array<Segment> = [];
		if (representation.segmentTemplate || representation.adaptationSet.segmentTemplate) {
			const mergedTemplate = deepmergeCustom({ mergeArrays: false })(
				representation.adaptationSet.segmentTemplate ?? {},
				representation.segmentTemplate,
			) as SegmentTemplate;
			segments = getSegmentsFromSegmentTemplate(
				this.getBaseUrl(representation),
				this.getPeriodDurationSeconds(representation.adaptationSet.period) ?? 0,
				representation,
				mergedTemplate,
			);
		}
		const contentProtection =
			representation.contentProtection ??
			representation.adaptationSet.contentProtection ??
			this.dashManifest?.contentProtection;
		if (contentProtection) {
			for (const protection of contentProtection) {
				const contentProtectionId = this.getContentProtectionId(protection);
				if (this.manifest.contentProtection[contentProtectionId]?.type === DrmSystem.UNKNOWN) {
					continue;
				}
				for (const segment of segments) {
					segment.contentProtectionIds ??= [];
					segment.contentProtectionIds.push(contentProtectionId);
				}
			}
		}
		return segments;
	}

	private parseVideoRepresentation(representation: RawRepresentation): void {
		const hasCea608 = representation.adaptationSet.accessibility?.some(
			(e: Descriptor) => e.schemeIdUri === CeaSchemeUri.CEA608,
		);
		const hasCea708 = representation.adaptationSet.accessibility?.some(
			(e: Descriptor) => e.schemeIdUri === CeaSchemeUri.CEA708,
		);
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
		if (representation.contentProtection) {
			for (const contentProtection of representation.contentProtection) {
				this.addContentProtection(contentProtection);
			}
		}
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
		if (adaptationSet.contentProtection) {
			for (const contentProtection of adaptationSet.contentProtection) {
				this.addContentProtection(contentProtection);
			}
		}
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
		p.duration = segments.slice(i).reduce((sum: number, seg: Segment) => sum + seg.duration, 0) / 1000;
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
