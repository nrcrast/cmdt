import { fromBinary } from "@bufbuild/protobuf";
import { DrmSystem } from "../../manifest.js";
import { stringify } from "uuid";
import { DrmParser, type PsshBox } from "../drm-system.js";
import { type WidevinePsshData, WidevinePsshDataSchema } from "./gen/license-protocol_pb.js";

export type WidevineData = {
	type: "widevine";
	box?: PsshBox;
	widevinePsshData: Omit<WidevinePsshData, "keyIds" | "protectionScheme" | "$typeName"> & {
		keyIds: Array<string>;
		protectionScheme: string;
	};
};

export class WidevineParser extends DrmParser<WidevineData> {
	public static override readonly systemId = "edef8ba9-79d6-4ace-a3c8-27dcd51d21ed";
	public parse(): WidevineData {
		const widevinePsshData = fromBinary(WidevinePsshDataSchema, this.psshBox.data);
		const protectionScheme = String.fromCharCode(
			(widevinePsshData.protectionScheme >> 24) & 0xff,
			(widevinePsshData.protectionScheme >> 16) & 0xff,
			(widevinePsshData.protectionScheme >> 8) & 0xff,
			widevinePsshData.protectionScheme & 0xff,
		);
		// biome-ignore lint: trying to just get $typeName out of the object
		const { $typeName, ...rest } = widevinePsshData;
		const friendlyPsshData = {
			...rest,
			keyIds: widevinePsshData.keyIds.map((kid) => stringify(kid)),
			protectionScheme,
		};
		let box: PsshBox | undefined;
		if (this.box) {
			box = {
				version: this.box.version,
				flags: this.box.flags,
				size: this.box.size,
				keyIds: this.psshBox.kids,
			};
		}
		return {
			type: DrmSystem.WIDEVINE,
			box,
			widevinePsshData: friendlyPsshData,
		};
	}
}
