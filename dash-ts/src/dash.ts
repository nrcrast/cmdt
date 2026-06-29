import { parse as parseDuration, toSeconds } from "iso8601-duration";
import xml2js from "xml2js";
import { parseBooleans, parseNumbers } from "xml2js/lib/processors.js";

// biome-ignore lint/suspicious/noExplicitAny: XML Node type isn't known during build time
export type XmlNode = any;

type Seconds = number;

type BaseUrl = {
	url: string;
	serviceLocation?: string;
	byteRange?: string;
	availabilityTimeOffset?: string;
	availabilityTimeComplete?: string;
	timeShiftBufferDepth?: Seconds;
	rangeAccess?: boolean;
};

export type Url = {
	sourceURL?: string;
	range?: string;
};

export type SegmentTimeline = {
	s?: Array<{
		t?: number;
		n?: number;
		d?: number;
		r: number;
	}>;
};

export type MultipleSegmentBaseInformation = {
	duration?: number;
	startNumber?: number;
	endNumber?: number;
	segmentTimeline?: SegmentTimeline;
} & SegmentBase;

export type SegmentBase = {
	timescale?: number;
	presentationTimeOffset?: number;
	presentationDuration?: number;
	timeShiftBufferDepth?: Seconds;
	indexRange?: string;
	availabilityTimeOffset?: number;
	availabilityTimeComplete?: boolean;
	initializationElement?: Url;
	representationIndex?: Url;
};

type SegmentUrl = {
	media?: string;
	mediaRange?: string;
	index?: string;
	indexRange?: string;
};

export type SegmentList = {
	segmentUrl?: SegmentUrl[];
} & MultipleSegmentBaseInformation;

export type SegmentTemplate = {
	media?: string;
	index?: string;
	initialization?: string;
	bitstreamSwitching?: string;
} & MultipleSegmentBaseInformation;

export type Descriptor = {
	schemeIdUri: string;
	value?: string;
	id?: string;
};

type Label = {
	id?: string;
	lang?: string;
	value: string;
};

type ProducerReferenceTime = {
	id: string;
	inBand?: boolean;
	type?: string;
	applicationScheme?: string;
	wallClockTime: string;
	presentationTime: string;
	utcTiming?: Descriptor[];
};

type RepresentationBase = {
	profiles?: string;
	width?: number;
	height?: number;
	sar?: string;
	frameRate?: string;
	audioSamplingRate?: string;
	mimeType?: string;
	segmentProfiles?: string;
	codecs?: string;
	"scte214:supplementalCodecs"?: string;
	containerProfiles?: string;
	maximumSAPPeriod?: number;
	startWithSAP?: string;
	maxPlayoutRate?: number;
	codingDependency?: boolean;
	scanType?: string;
	selectionPriority?: number;
	tag?: string;
	framePacking?: Descriptor[];
	audioChannelConfiguration?: Descriptor[];
	contentProtection?: ContentProtection[];
	outputProtection?: Descriptor[];
	essentialProperty?: Descriptor[];
	supplementalProperty?: Descriptor[];
	label?: Label[];
	groupLabel?: Label[];
	producerReferenceTime?: ProducerReferenceTime[];
};

export type ContentType = "video" | "audio" | "image" | "text" | "application" | "font";

export type Representation = {
	id: string;
	bandwidth: number;
	baseUrl?: BaseUrl[];
	segmentBase?: SegmentBase;
	segmentList?: SegmentList;
	segmentTemplate?: SegmentTemplate;
	adaptationSet: AdaptationSet;
} & RepresentationBase;

export type AdaptationSet = {
	id?: string;
	lang?: string; // Not DASH standard, but does appear sometimes
	contentType?: ContentType;
	par?: string;
	minBandwidth?: number;
	maxBandwidth?: number;
	minWidth?: number;
	maxWidth?: number;
	minHeight?: number;
	maxHeight?: number;
	minFrameRate?: string;
	maxFrameRate?: string;
	segmentAlignment?: boolean;
	bitstreamSwitching?: boolean;
	subsegmentAlignment?: boolean;
	subsegmentStartsWithSAP?: number;
	accessibility?: Descriptor[];
	role?: Descriptor[];
	baseUrl?: BaseUrl[];
	segmentBase?: SegmentBase;
	segmentList?: SegmentList;
	segmentTemplate?: SegmentTemplate;
	representation?: Representation[];
	period: Period;
} & RepresentationBase;

type Event = {
	id?: string;
	duration?: number;
	presentationTime?: number;
	"scte35:signal"?: {
		"scte35:binary": string;
	};
};

export type EventStream = {
	timescale?: number;
	presentationTimeOffset?: number;
	event: Event[];
} & Descriptor;

export type Period = {
	id?: string;
	start?: Seconds;
	startString?: string;
	bitstreamSwitching?: boolean;
	baseUrl?: BaseUrl[];
	duration?: Seconds;
	segmentBase?: SegmentBase;
	segmentList?: SegmentList;
	segmentTemplate?: SegmentTemplate;
	contentProtection?: ContentProtection[];
	adaptationSet?: AdaptationSet[];
	eventStream?: EventStream[];
	manifest: MPD;
};

export type PlayReadyInfo = {
	cencPssh: string;
	isEncrypted: number;
	ivSize: number;
	kid: string;
	pro: string;
};

export type WidevineInfo = {
	cencPssh: string;
};

export type ContentProtection = {
	schemeIdUri: string;
	value?: string;
	ref?: string;
	refId?: string;
	robustness?: string;
	cencDefaultKid?: string;
	playready?: PlayReadyInfo;
	widevine?: WidevineInfo;
};

export type MPD = {
	id?: string;
	profiles: string;
	type: "static" | "dynamic"; // Default 'static'
	availabilityStartTime?: string; // Required for dynamic
	publishTime?: string; // Required for dynamic
	availabilityEndTime?: string;
	mediaPresentationDuration?: Seconds;
	minimumUpdatePeriod?: Seconds;
	minBufferTime: Seconds;
	timeShiftBufferDepth?: Seconds;
	suggestedPresentationDelay?: Seconds;
	maxSegmentDuration?: Seconds;
	maxSubsegmentDuration?: Seconds;
	baseUrl?: BaseUrl[];
	location?: Location[];
	periods: Period[];
	contentProtection?: ContentProtection[];
};

function optionalDurationToSeconds(input?: string): Seconds | undefined {
	if (!input) {
		return undefined;
	}
	return toSeconds(parseDuration(input));
}

function requiredDurationToSeconds(input: string): Seconds {
	return toSeconds(parseDuration(input));
}

function parseBaseUrls(baseUrlRoot: XmlNode): BaseUrl[] | undefined {
	return baseUrlRoot?.map((e: XmlNode) => {
		return {
			url: e._,
			serviceLocation: e.$?.serviceLocation,
			byteRange: e.$?.byteRange,
			availabilityTimeOffset: e.$?.availabilityTimeOffset,
			availabilityTimeComplete: e.$?.availabilityTimeComplete,
			timeShiftBufferDepth: optionalDurationToSeconds(e.$?.timeShiftBufferDepth),
			rangeAccess: e.$?.rangeAccess,
		};
	});
}

function parseContentProtection(contentProtectionRoot: XmlNode): ContentProtection[] | undefined {
	return contentProtectionRoot?.map((e: XmlNode) => {
		const baseProtection: ContentProtection = {
			schemeIdUri: e.$.schemeIdUri,
			value: e.$?.value,
			ref: e.$?.ref,
			refId: e.$?.refId,
			robustness: e.$?.robustness,
			cencDefaultKid: e.$["cenc:default_KID"],
		};
		switch (baseProtection.schemeIdUri) {
			case "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95": {
				baseProtection.playready = {
					cencPssh: e["cenc:pssh"]?.[0]?._,
					isEncrypted: e["mspr:IsEncrypted"]?.[0]?._,
					ivSize: e["mspr:IV_Size"]?.[0]?._,
					kid: e["mspr:kid"]?.[0]?._,
					pro: e["mspr:pro"]?.[0]?._,
				};
				break;
			}
			case "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed": {
				baseProtection.widevine = {
					cencPssh: e["cenc:pssh"]?.[0]?._,
				};
				break;
			}
		}
		return baseProtection;
	});
}

function parseUrl(urlRoot: XmlNode): Url | undefined {
	if (!urlRoot) {
		return undefined;
	}
	return {
		sourceURL: urlRoot.$.sourceURL,
		range: urlRoot.$.range,
	};
}

function parseSegmentBase(segmentBaseRoot: XmlNode): SegmentBase | undefined {
	if (!segmentBaseRoot) {
		return undefined;
	}

	return {
		timescale: segmentBaseRoot.$.timescale,
		presentationTimeOffset: segmentBaseRoot.$.presentationTimeOffset,
		presentationDuration: segmentBaseRoot.$.presentationDuration,
		timeShiftBufferDepth: optionalDurationToSeconds(segmentBaseRoot.$.timeShiftBufferDepth),
		indexRange: segmentBaseRoot.$.indexRange,
		availabilityTimeOffset: segmentBaseRoot.$.availabilityTimeOffset,
		availabilityTimeComplete: segmentBaseRoot.$.availabilityTimeComplete,
		initializationElement: parseUrl(segmentBaseRoot.Initialization?.[0]),
		representationIndex: parseUrl(segmentBaseRoot.RepresentationIndex?.[0]),
	};
}

function parseSegmentTimeline(segmentTimelineRoot: XmlNode): SegmentTimeline | undefined {
	if (!segmentTimelineRoot) {
		return undefined;
	}

	return {
		s: segmentTimelineRoot.S?.map((e: XmlNode) => {
			return {
				t: e.$.t,
				n: e.$.n,
				d: e.$.d,
				r: e.$.r ?? 0,
			};
		}),
	};
}

function parseSegmentUrl(segmentUrlRoot: XmlNode): SegmentUrl[] | undefined {
	return segmentUrlRoot?.map((e: XmlNode) => {
		return {
			media: e.$.media,
			mediaRange: e.$.mediaRange,
			index: e.$.index,
			indexRange: e.$.indexRange,
		};
	});
}

function parseDescriptor(descriptorRoot: XmlNode): Descriptor[] | undefined {
	return descriptorRoot?.map((e: XmlNode) => {
		return {
			schemeIdUri: e.$.schemeIdUri,
			value: e.$.value,
			id: e.$?.id,
		};
	});
}

function parseLabel(labelRoot: XmlNode): Label[] | undefined {
	return labelRoot?.map((e: XmlNode) => {
		return {
			id: e.$?.id,
			lang: e.$?.lang,
			value: e._,
		};
	});
}

function parseProducerReferenceTime(producerReferenceTimeRoot: XmlNode): ProducerReferenceTime[] | undefined {
	return producerReferenceTimeRoot?.map((e: XmlNode): ProducerReferenceTime => {
		return {
			id: e.$.id,
			inBand: e.$.inBand,
			type: e.$.type,
			applicationScheme: e.$.applicationScheme,
			wallClockTime: e.$.wallClockTime,
			presentationTime: e.$.presentationTime,
			utcTiming: parseDescriptor(e.UTCTiming),
		};
	});
}

function parseRepresentationBase(representationBaseRoot: XmlNode): RepresentationBase | undefined {
	if (!representationBaseRoot) {
		return undefined;
	}

	let label = parseLabel(representationBaseRoot.Label);
	if (!label && representationBaseRoot.$.Label) {
		label = [{ value: representationBaseRoot.$.Label }];
	}

	return {
		profiles: representationBaseRoot.$.profiles,
		width: representationBaseRoot.$.width,
		height: representationBaseRoot.$.height,
		sar: representationBaseRoot.$.sar,
		frameRate: representationBaseRoot.$.frameRate?.toString(),
		audioSamplingRate: representationBaseRoot.$.audioSamplingRate,
		mimeType: representationBaseRoot.$.mimeType,
		segmentProfiles: representationBaseRoot.$.segmentProfiles,
		codecs: representationBaseRoot.$.codecs,
		containerProfiles: representationBaseRoot.$.containerProfiles,
		maximumSAPPeriod: representationBaseRoot.$.maximumSAPPeriod,
		startWithSAP: representationBaseRoot.$.startWithSAP,
		maxPlayoutRate: representationBaseRoot.$.maxPlayoutRate,
		codingDependency: representationBaseRoot.$.codingDependency,
		scanType: representationBaseRoot.$.scanType,
		selectionPriority: representationBaseRoot.$.selectionPriority,
		tag: representationBaseRoot.$.tag,
		"scte214:supplementalCodecs": representationBaseRoot.$["scte214:supplementalCodecs"],
		framePacking: parseDescriptor(representationBaseRoot.FramePacking),
		audioChannelConfiguration: parseDescriptor(representationBaseRoot.AudioChannelConfiguration),
		contentProtection: parseContentProtection(representationBaseRoot.ContentProtection),
		outputProtection: parseDescriptor(representationBaseRoot.OutputProtection),
		essentialProperty: parseDescriptor(representationBaseRoot.EssentialProperty),
		supplementalProperty: parseDescriptor(representationBaseRoot.SupplementalProperty),
		// inbandEventStream: parseEventStream(representationBaseRoot.InbandEventStream),
		label,
		groupLabel: parseLabel(representationBaseRoot.GroupLabel),
		producerReferenceTime: parseProducerReferenceTime(representationBaseRoot.ProducerReferenceTime),
	};
}

function parseMultiSegmentBaseInformation(multiSegmentBaseInformationRoot: XmlNode): MultipleSegmentBaseInformation {
	return {
		duration: multiSegmentBaseInformationRoot.$.duration,
		startNumber: multiSegmentBaseInformationRoot.$.startNumber,
		endNumber: multiSegmentBaseInformationRoot.$.endNumber,
		segmentTimeline: parseSegmentTimeline(multiSegmentBaseInformationRoot.SegmentTimeline?.[0]),
		initializationElement: parseUrl(multiSegmentBaseInformationRoot.Initialization?.[0]),
		indexRange: multiSegmentBaseInformationRoot.$.indexRange,
		availabilityTimeOffset: multiSegmentBaseInformationRoot.$.availabilityTimeOffset,
		availabilityTimeComplete: multiSegmentBaseInformationRoot.$.availabilityTimeComplete,
		representationIndex: parseUrl(multiSegmentBaseInformationRoot.RepresentationIndex?.[0]),
		timescale: multiSegmentBaseInformationRoot.$.timescale,
		presentationTimeOffset: multiSegmentBaseInformationRoot.$.presentationTimeOffset,
		presentationDuration: multiSegmentBaseInformationRoot.$.presentationDuration,
		timeShiftBufferDepth: optionalDurationToSeconds(multiSegmentBaseInformationRoot.$.timeShiftBufferDepth),
	};
}

function parseSegmentTemplate(segmentTemplateRoot: XmlNode): SegmentTemplate | undefined {
	if (!segmentTemplateRoot) {
		return undefined;
	}
	const multiSegmentInfo = parseMultiSegmentBaseInformation(segmentTemplateRoot);
	return {
		media: segmentTemplateRoot.$.media,
		index: segmentTemplateRoot.$.index,
		initialization: segmentTemplateRoot.$.initialization,
		bitstreamSwitching: segmentTemplateRoot.$.bitstreamSwitching,
		...multiSegmentInfo,
	};
}

function parseSegmentList(segmentListRoot: XmlNode): SegmentList | undefined {
	if (!segmentListRoot) {
		return undefined;
	}

	return {
		duration: segmentListRoot.$.duration,
		startNumber: segmentListRoot.$.startNumber,
		endNumber: segmentListRoot.$.endNumber,
		segmentTimeline: parseSegmentTimeline(segmentListRoot.SegmentTimeline?.[0]),
		initializationElement: parseUrl(segmentListRoot.Initialization?.[0]),
		segmentUrl: parseSegmentUrl(segmentListRoot.SegmentURL),
		timescale: segmentListRoot.$.timescale,
		presentationTimeOffset: segmentListRoot.$.presentationTimeOffset,
		presentationDuration: segmentListRoot.$.presentationDuration,
		timeShiftBufferDepth: optionalDurationToSeconds(segmentListRoot.$.timeShiftBufferDepth),
		indexRange: segmentListRoot.$.indexRange,
		availabilityTimeOffset: segmentListRoot.$.availabilityTimeOffset,
		availabilityTimeComplete: segmentListRoot.$.availabilityTimeComplete,
		representationIndex: parseUrl(segmentListRoot.RepresentationIndex?.[0]),
	};
}

function parseRepresentation(representationRoot: XmlNode, adaptationSet: AdaptationSet): Representation[] | undefined {
	return representationRoot?.map((e: XmlNode) => {
		return {
			id: e.$.id.toString(),
			bandwidth: e.$.bandwidth,
			baseUrl: parseBaseUrls(e.BaseURL),
			segmentBase: parseSegmentBase(e.SegmentBase?.[0]),
			segmentList: parseSegmentList(e.SegmentList?.[0]),
			segmentTemplate: parseSegmentTemplate(e.SegmentTemplate?.[0]),
			adaptationSet,
			...parseRepresentationBase(e),
		};
	});
}

function parseAdaptationSet(adaptationSetRoot: XmlNode, period: Period): AdaptationSet[] | undefined {
	return adaptationSetRoot?.map((e: XmlNode) => {
		const adaptationSet: AdaptationSet = {
			id: e.$?.id?.toString(),
			lang: e.$?.lang,
			contentType: e.$?.contentType,
			par: e.$?.par,
			minBandwidth: e.$?.minBandwidth,
			maxBandwidth: e.$?.maxBandwidth,
			minWidth: e.$?.minWidth,
			maxWidth: e.$?.maxWidth,
			minHeight: e.$?.minHeight,
			maxHeight: e.$?.maxHeight,
			minFrameRate: e.$?.minFrameRate?.toString(),
			maxFrameRate: e.$?.maxFrameRate?.toString(),
			segmentAlignment: e.$?.segmentAlignment,
			bitstreamSwitching: e.$?.bitstreamSwitching,
			subsegmentAlignment: e.$?.subsegmentAlignment,
			subsegmentStartsWithSAP: e.$?.subsegmentStartsWithSAP,
			accessibility: parseDescriptor(e.Accessibility),
			role: parseDescriptor(e.Role),
			baseUrl: parseBaseUrls(e.BaseURL),
			segmentBase: parseSegmentBase(e.SegmentBase?.[0]),
			segmentList: parseSegmentList(e.SegmentList?.[0]),
			segmentTemplate: parseSegmentTemplate(e.SegmentTemplate?.[0]),
			...parseRepresentationBase(e),
			period,
		};
		adaptationSet.representation = parseRepresentation(e.Representation, adaptationSet);
		return adaptationSet;
	});
}

function parseEvent(eventRoot: XmlNode): Event[] | undefined {
	return eventRoot?.map((e: XmlNode) => {
		// The SCTE-35 XML schema defines capitalized <Signal>/<Binary>, but some
		// packagers emit lowercase. xml2js preserves element-name case, so accept both.
		const signal = e["scte35:Signal"]?.[0] ?? e["scte35:signal"]?.[0];
		const binary = signal?.["scte35:Binary"]?.[0]?._ ?? signal?.["scte35:binary"]?.[0]?._;
		return {
			id: e.$?.id?.toString(),
			duration: e.$?.duration,
			presentationTime: e.$.presentationTime,
			"scte35:signal": {
				"scte35:binary": binary,
			},
		};
	});
}

function parseEventStream(eventStreamRoot: XmlNode): EventStream[] | undefined {
	return eventStreamRoot?.map((e: XmlNode) => {
		return {
			timescale: e.$.timescale,
			presentationTimeOffset: e.$.presentationTimeOffset,
			event: parseEvent(e.Event) ?? [],
			schemeIdUri: e.$.schemeIdUri,
			value: e.$.value,
		};
	});
}

export function parsePeriods(periodRoot: XmlNode, mpd: MPD): Period[] {
	return periodRoot.map((e: XmlNode) => {
		const period: Period = {
			id: e.$?.id?.toString(),
			start: optionalDurationToSeconds(e.$?.start),
			duration: optionalDurationToSeconds(e.$?.duration),
			startString: e.$?.start,
			bitstreamSwitching: e.$?.bitstreamSwitching,
			baseUrl: parseBaseUrls(e.BaseURL),
			segmentBase: parseSegmentBase(e.SegmentBase?.[0]),
			segmentList: parseSegmentList(e.SegmentList?.[0]),
			segmentTemplate: parseSegmentTemplate(e.SegmentTemplate?.[0]),
			eventStream: parseEventStream(e.EventStream),
			contentProtection: parseContentProtection(e.ContentProtection),
			manifest: mpd,
		};
		period.adaptationSet = parseAdaptationSet(e.AdaptationSet, period);
		return period;
	});
}

export async function getRawDashManifest(manifest: string): Promise<MPD> {
	const raw = await xml2js.parseStringPromise(manifest, {
		explicitArray: true,
		explicitCharkey: true,
		attrValueProcessors: [parseNumbers, parseBooleans],
	});
	const mpd: MPD = {
		profiles: raw.MPD.$.profiles,
		id: raw.MPD.$.id,
		type: raw.MPD.$.type ?? "static",
		availabilityStartTime: raw.MPD.$.availabilityStartTime,
		publishTime: raw.MPD.$.publishTime,
		availabilityEndTime: raw.MPD.$.availabilityEndTime,
		mediaPresentationDuration: optionalDurationToSeconds(raw.MPD.$.mediaPresentationDuration),
		minimumUpdatePeriod: optionalDurationToSeconds(raw.MPD.$.minimumUpdatePeriod),
		minBufferTime: requiredDurationToSeconds(raw.MPD.$.minBufferTime),
		timeShiftBufferDepth: optionalDurationToSeconds(raw.MPD.$.timeShiftBufferDepth),
		suggestedPresentationDelay: optionalDurationToSeconds(raw.MPD.$.suggestedPresentationDelay),
		maxSegmentDuration: optionalDurationToSeconds(raw.MPD.$.maxSegmentDuration),
		maxSubsegmentDuration: optionalDurationToSeconds(raw.MPD.$.maxSubsegmentDuration),
		baseUrl: parseBaseUrls(raw.MPD.BaseURL),
		periods: [],
		contentProtection: parseContentProtection(raw.MPD.ContentProtection),
	};
	mpd.periods = parsePeriods(raw.MPD.Period, mpd);
	return mpd;
}
