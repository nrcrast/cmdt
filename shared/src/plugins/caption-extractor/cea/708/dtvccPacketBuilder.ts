import { CcType, type Cea708ClosedCaptionByte } from "../../../../utils/text/types.js";
import DtvccPacket from "./dtvccPacket.js";

/**
 * CEA-708 DTVCC Packet Builder.
 * Builds packets based on Figure 5 CCP State Table in 5.2 of CEA-708-E.
 * Initially, there is no packet. When a DTVCC_PACKET_START payload is received,
 * a packet begins construction. The packet is considered "built" once all bytes
 * indicated in the header are read, and ignored if a new packet starts building
 * before the current packet is finished being built.
 */
class DtvccPacketBuilder {
	// An array containing built DTVCC packets that are ready to be processed
	private _builtPackets: Array<DtvccPacket> = [];
	// Stores the packet data for the current packet being processed, if any
	private _currentPacketBeingBuilt: Array<Cea708ClosedCaptionByte> | null = null;
	// Keeps track of the number of bytes left to add in the current packet
	private _bytesLeftToAddInCurrentPacket = 0;

	public getBuiltPackets(): Array<DtvccPacket> {
		return this._builtPackets;
	}

	public addByte(cea708Byte: Cea708ClosedCaptionByte): void {
		if (cea708Byte.type === CcType.DTVCC_PACKET_START) {
			// If there was a packet being built that finished, it would have
			// already been added to the built packets when it finished. So if
			// there's an open packet at this point, it must be unfinished. As
			// per the spec, we don't deal with unfinished packets. So we ignore them.

			// A new packet should be opened.
			const packetSize: number = cea708Byte.value & 0x3f;

			// As per spec, number of packet data bytes to follow is packetSize*2-1.
			this._bytesLeftToAddInCurrentPacket = packetSize * 2 - 1;
			this._currentPacketBeingBuilt = [];

			return;
		}

		if (!this._currentPacketBeingBuilt) {
			// There is no packet open. Then an incoming byte should not
			// have come in at all. Ignore it.
			return;
		}

		if (this._bytesLeftToAddInCurrentPacket > 0) {
			this._currentPacketBeingBuilt.push(cea708Byte);
			this._bytesLeftToAddInCurrentPacket--;
		}

		if (this._bytesLeftToAddInCurrentPacket === 0) {
			// Current packet is complete and ready for processing.
			const packet: DtvccPacket = new DtvccPacket(this._currentPacketBeingBuilt);
			this._builtPackets.push(packet);
			this._currentPacketBeingBuilt = null;
			this._bytesLeftToAddInCurrentPacket = 0;
		}
	}

	/** Clear built packets. */
	public clearBuiltPackets(): void {
		this._builtPackets.length = 0;
	}

	// Clear built packets and packets in progress
	public clear(): void {
		this._builtPackets = [];
		this._currentPacketBeingBuilt = [];
		this._bytesLeftToAddInCurrentPacket = 0;
	}
}

export default DtvccPacketBuilder;
