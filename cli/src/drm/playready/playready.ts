import DataViewReader from "../../utils/mp4/dataViewReader.js";
import { Endian } from "../../utils/mp4/types.js";
import { DrmParser } from "../drm-system.js";
import { getInstance as getLogger } from "../../logger.js";
import { DrmSystem } from "cmdt-shared";

type PlayreadyHeader = PlayreadyObjectRecord[];
type PlayreadyObjectRecord = {
	type: number;
	data: string;
};

export enum PlayreadyHeaderType {
	PRH = 1,
	RESERVED = 2,
	ELS = 3,
}

export type PlayreadyData = {
	type: DrmSystem.PLAYREADY;
	playreadyHeader: PlayreadyHeader;
};

export class PlayreadyParser extends DrmParser<PlayreadyData> {
	private logger = getLogger();
	public static override readonly systemId = "9a04f079-9840-4286-ab92-e65be0885f95";
	public parse(): PlayreadyData {
		const reader = new DataViewReader(this.psshBox.data, Endian.LITTLE);
		const header: PlayreadyHeader = [];
		reader.readUint32(); // Total length
		const objectCount = reader.readUint16();

		for (let i = 0; i < objectCount; i++) {
			const type = reader.readUint16();
			const length = reader.readUint16();
			const rawData = reader.readBytes(length);
			if(type !== PlayreadyHeaderType.PRH) {
				this.logger.debug("Skipping non-PRH data");
				continue;
			}
			const data = new TextDecoder('utf-16').decode(rawData);
			header.push({ type, data });
		}
		return {
			type: DrmSystem.PLAYREADY,
			playreadyHeader: header,
		};
	}
}
