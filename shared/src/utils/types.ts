// Enums
export enum CeaSchemeUri {
	CEA608 = "urn:scte:dash:cc:cea-608:2015",
	CEA708 = "urn:scte:dash:cc:cea-708:2015",
}

export enum SchemeUri {
	WIDEVINE = "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",
	PLAYREADY = "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95",
}

// Types
export type DataSegment = {
	id: number;
	data: ArrayBuffer | string | null;
};
