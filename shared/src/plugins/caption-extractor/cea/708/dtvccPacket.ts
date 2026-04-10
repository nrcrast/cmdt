import type { Cea708ClosedCaptionByte } from "../../../../utils/text/types.js";
import { ILogObj, Logger } from "tslog";

class DtvccPacket {
	private _pos = 0;
	private logger: Logger<ILogObj>;

	constructor(private _packetData: Array<Cea708ClosedCaptionByte>) {
		this.logger = new Logger<ILogObj>();
	}

	public getPosition(): number {
		return this._pos;
	}

	public hasMoreData(): boolean {
		return this._pos < this._packetData.length;
	}

	// Reads a byte from the packet
	public readByte(): Cea708ClosedCaptionByte {
		const byte = this._packetData[this._pos];
		if (!byte) {
			throw new Error("No byte to read");
		}
		this._pos++;
		return byte;
	}

	// Skips the provided number of blocks in the buffer
	public skip(numBlocks: number): void {
		if (this._pos + numBlocks > this._packetData.length) {
			const message: string = "Buffer position out of bounds";
			this.logger.debug(message);
		}
		this._pos += numBlocks;
	}
}

export default DtvccPacket;
