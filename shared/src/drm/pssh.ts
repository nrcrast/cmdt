import { type ILogObj, Logger } from "tslog";
import Mp4Parser from "../utils/mp4/mp4-parser.js";
import type { ParsedBox, Pssh } from "../utils/mp4/types.js";
import { type PlayreadyData, PlayreadyParser } from "./playready/playready.js";
import { type WidevineData, WidevineParser } from "./widevine/widevine.js";

export class PsshParser {
	private logger = new Logger<ILogObj>();
	private parserConstructors = new Map<string, typeof WidevineParser | typeof PlayreadyParser>();
	constructor() {
		this.parserConstructors.set(WidevineParser.systemId, WidevineParser);
		this.parserConstructors.set(PlayreadyParser.systemId, PlayreadyParser);
	}
	public parseFromBox(box: Pssh, rawBox?: ParsedBox): WidevineData | PlayreadyData | undefined {
		const parserConstructor = this.parserConstructors.get(box.systemId);
		if (!parserConstructor) {
			return;
		}
		const drmParser = new parserConstructor(box, rawBox);
		try {
			return drmParser.parse();
		} catch (e) {
			this.logger.error(e);
		}
	}
	parse(data: Uint8Array): WidevineData | PlayreadyData | undefined {
		const parser = new Mp4Parser();
		let psshData: WidevineData | PlayreadyData | undefined;
		parser
			.fullBox("pssh", (box: ParsedBox) => {
				const pssh = Mp4Parser.parsePssh(box);
				psshData = this.parseFromBox(pssh);
				const parserConstructor = this.parserConstructors.get(pssh.systemId);
				if (!parserConstructor) {
					return;
				}
				const drmParser = new parserConstructor(pssh, box);
				psshData = drmParser.parse();
			})
			.box("moov", Mp4Parser.children)
			.parse(new Uint8Array(data).buffer);
		return psshData;
	}
}
