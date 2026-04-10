import { CeaSchemeUri } from "../../../utils/types.js";
import DataViewReader from "../../../utils/mp4/dataViewReader.js";
import { Endian } from "../../../utils/mp4/types.js";
import { CcType, type Cea608ClosedCaptionPacket, type Cea708ClosedCaptionByte } from "../../../utils/text/types.js";
import Cea608DataChannel from "./608/cea608DataChannel.js";
import Cea708Service from "./708/cea708Service.js";
import type DtvccPacket from "./708/dtvccPacket.js";
import DtvccPacketBuilder from "./708/dtvccPacketBuilder.js";
import { ILogObj, Logger } from "tslog";
import { Cue } from "../../../cue.js";

class CeaDecoder {
	// An array of CEA-608 closed caption data extracted for decoding
	private _cea608DataArray: Array<Cea608ClosedCaptionPacket> = [];
	// An array of CEA-708 closed caption data extracted for decoding
	private _cea708DataArray: Array<Cea708ClosedCaptionByte> = [];
	// A DTVCC Packet builder for CEA-708 data
	private _dtvccPacketBuilder: DtvccPacketBuilder;
	// Number of consecutive bad frames decoded on CEA-608
	private _badFrames = 0;
	// A map containing the stream for each mode
	private _cea608ModeToStream: Map<string, Cea608DataChannel>;
	// The current channel that is active on CEA-608 field 1
	private _currentField1Channel = 0;
	// The current channel that is active on CEA-608 field 2
	private _currentField2Channel = 0;
	// Map of service number to CEA-708 services, initially empty. Since there
	// can be up to 63 services, they are created dynamically only when needed
	private _serviceNumberToCea708Service = new Map<number, Cea708Service>();

	// 0xB5 is USA's code (Rec. ITU-T T.35)
	private _USA_COUNTRY_CODE = 0xb5;
	// itu_t_35_provider_code for ATSC user_data
	private _ATSC_PROVIDER_CODE = 0x0031;
	// When provider is ATSC user data, the ATSC_user_identifier code
	// for ATSC1_data is "GA94" (0x47413934)
	private _ATSC1_USER_IDENTIFIER = 0x47413934;
	// Caption packet min length
	// Country Code + ATSC_PROVIDER_CODE + ATSC_1_USER_IDENTIFIER + USER_DATA_TYPE
	private _MIN_LENGTH = 8;

	private _shouldSetFirstPts = true;

	constructor() {
		this._dtvccPacketBuilder = new DtvccPacketBuilder();
		this._cea608ModeToStream = new Map<string, Cea608DataChannel>([
			["CC1", new Cea608DataChannel(0, 0)], // F1 + C1 -> CC1
			["CC2", new Cea608DataChannel(0, 1)], // F1 + C2 -> CC2
			["CC3", new Cea608DataChannel(1, 0)], // F2 + C1 -> CC3
			["CC4", new Cea608DataChannel(1, 1)], // F2 + C2 -> CC4
		]);

		this.reset();
	}

	// Resets the decoder.
	private reset(): void {
		this._currentField1Channel = 0;
		this._currentField2Channel = 0;
		this._cea608ModeToStream.forEach((stream: Cea608DataChannel) => {
			stream.reset();
		});
		this._shouldSetFirstPts = true;
	}

	// Decodes a CEA-608 closed caption packet based on ANSI/CEA-608
	private decodeCea608(ccPacket: Cea608ClosedCaptionPacket): Cue | null {
		const fieldNum: number = ccPacket.type;

		// If this packet is a control code, then it also sets the channel
		// For control codes, cc_data_1 has the form |P|0|0|1|C|X|X|X|
		// "C" is the channel bit. It indicates whether to set C2 active
		if (this.isControlCode(ccPacket.ccData1)) {
			const channelNum: number = (ccPacket.ccData1 >> 3) & 0x01; // Get channel bit

			// Change the stream based on the field, and the new channel
			if (fieldNum === 0) {
				this._currentField1Channel = channelNum;
			} else {
				this._currentField2Channel = channelNum;
			}
		}

		// Get the correct stream for this caption packet (CC1, ..., CC4)
		const selectedChannel: number = fieldNum ? this._currentField2Channel : this._currentField1Channel;
		const selectedMode: string = `CC${(fieldNum << 1) | (selectedChannel + 1)}`;
		const selectedStream: Cea608DataChannel | undefined = this._cea608ModeToStream.get(selectedMode);
		if (!selectedStream) {
			return null;
		}

		// Check for bad frames (bad pairs). This can be two 0xff, two 0x00, or any
		// byte of even parity. ccData1 and ccData2 should be uint8 of odd parity
		if (
			(ccPacket.ccData1 === 0xff && ccPacket.ccData2 === 0xff) ||
			(!ccPacket.ccData1 && !ccPacket.ccData2) ||
			!this.isOddParity(ccPacket.ccData1) ||
			!this.isOddParity(ccPacket.ccData2)
		) {
			// Per CEA-608-B C.21, reset the memory after 45 consecutive bad frames
			if (++this._badFrames >= 45) {
				this.reset();
			}

			return null;
		}
		this._badFrames = 0;

		// Remove the MSB (parity bit)
		ccPacket.ccData1 &= 0x7f;
		ccPacket.ccData2 &= 0x7f;

		// Check for empty captions and skip them.
		if (!ccPacket.ccData1 && !ccPacket.ccData2) {
			return null;
		}

		// Process the clean CC data pair
		let parsedClosedCaption: Cue | null = null;
		if (this.isControlCode(ccPacket.ccData1)) {
			parsedClosedCaption = selectedStream.handleControlCode(ccPacket);
		} else {
			// Handle as a Basic North American Character
			selectedStream.handleBasicNorthAmericanChar(ccPacket.ccData1, ccPacket.ccData2);
		}

		return parsedClosedCaption;
	}

	// Decodes a CEA-708 DTVCC packet based on ANSI/CTA-708-E
	private decodeCea708(dtvccPacket: DtvccPacket): Array<Cue> {
		const parsedClosedCaptions: Array<Cue> = [];
		try {
			while (dtvccPacket.hasMoreData()) {
				// Process a service block.
				const serviceBlockHeader: number = dtvccPacket.readByte().value;

				// First 3 bits are service number, next 5 are block size,
				// representing the number of bytes coming in this block
				// (discluding a possible extended service block header byte)
				let serviceNumber: number = (serviceBlockHeader & 0xe0) >> 5;
				const blockSize: number = serviceBlockHeader & 0x1f;

				if (serviceNumber === /* 0b111 */ 0x07 && blockSize !== 0) {
					// 2 bits null padding, 6 bits extended service number
					const extendedServiceBlockHeader: number = dtvccPacket.readByte().value;
					serviceNumber = extendedServiceBlockHeader & 0x3f;
				}

				// As per CEA-708-E, service number 0 is invalid, and should be ignored
				if (serviceNumber !== 0) {
					// If the service doesn't already exist, create it
					if (!this._serviceNumberToCea708Service.has(serviceNumber)) {
						const service: Cea708Service = new Cea708Service(serviceNumber);
						this._serviceNumberToCea708Service.set(serviceNumber, service);
					}
					const service: Cea708Service | undefined = this._serviceNumberToCea708Service.get(serviceNumber);

					// Process all control codes
					const startPos: number = dtvccPacket.getPosition();

					// Execute this loop `blockSize` times, to decode the control codes
					while (dtvccPacket.getPosition() - startPos < blockSize) {
						if (service) {
							const closedCaption: Cue | null = service.handleCea708ControlCode(dtvccPacket);
							if (closedCaption) {
								parsedClosedCaptions.push(closedCaption);
							}
						}
					} // position < end of block
				} // serviceNumber != 0
			} // hasMoreData
			// biome-ignore lint/correctness/noUnusedVariables: Error handling
		} catch (error) {
			// do nothing
		}

		return parsedClosedCaptions;
	}

	// Checks if the data contains a control code
	private isControlCode(b1: number): boolean {
		// For control codes, the first byte takes the following form:
		// b1 -> |P|0|0|1|X|X|X|X|
		return (b1 & 0x70) === 0x10;
	}

	// Checks if a byte has odd parity (Odd number of 1s in binary).
	private isOddParity(byte: number): boolean {
		let parity = 0;
		while (byte) {
			parity ^= byte & 1; // toggle parity if low bit is 1
			byte >>= 1; // shift away the low bit
		}

		return parity === 1;
	}

	// Extracts closed caption bytes from CEA-X08 packets from the stream based on ANSI/SCTE 128 and A/53, Part 4
	public extract(userDataSeiMessage: Uint8Array, pts: number, ceaSchemeUri: CeaSchemeUri): void {
		if (this._shouldSetFirstPts) {
			this._cea608ModeToStream.forEach((stream: Cea608DataChannel) => {
				stream.setFirstPts(pts);
			});
			this._shouldSetFirstPts = false;
		}

		const reader: DataViewReader = new DataViewReader(userDataSeiMessage, Endian.BIG, new Logger<ILogObj>());

		if (reader.getLength() < this._MIN_LENGTH) {
			return;
		}
		if (reader.readUint8() !== this._USA_COUNTRY_CODE) {
			return;
		}
		if (reader.readUint16() !== this._ATSC_PROVIDER_CODE) {
			return;
		}
		if (reader.readUint32() !== this._ATSC1_USER_IDENTIFIER) {
			return;
		}

		// user_data_type_code: 0x03 - cc_data()
		if (reader.readUint8() !== 0x03) {
			return;
		}

		// 1 bit reserved
		// 1 bit process_cc_data_flag
		// 1 bit zero_bit
		// 5 bits cc_count
		const captionData: number = reader.readUint8();
		// If process_cc_data_flag is not set, do not process this data
		if ((captionData & 0x40) === 0) {
			return;
		}

		const count: number = captionData & 0x1f;

		// 8 bits reserved
		reader.skip(1);

		for (let i = 0; i < count; i++) {
			const cc: number = reader.readUint8();
			// When ccValid is 0, the next two bytes should be discarded
			const ccValid: number = (cc & 0x04) >> 2;
			const ccData1: number = reader.readUint8();
			const ccData2: number = reader.readUint8();

			if (ccValid) {
				const ccType: number = cc & 0x03;
				// Send the packet to the appropriate data array (CEA-608 or CEA-708)
				if (ceaSchemeUri === CeaSchemeUri.CEA608) {
					// CEA-608 NTSC (Line 21) Data
					this._cea608DataArray.push({
						pts,
						type: ccType,
						ccData1,
						ccData2,
						order: this._cea608DataArray.length,
					});
				} else if (ceaSchemeUri === CeaSchemeUri.CEA708) {
					// CEA-708 DTVCC Data
					this._cea708DataArray.push({
						pts,
						type: ccType,
						value: ccData1,
						order: this._cea708DataArray.length,
					});

					// The second byte should always be labelled as DTVCC packet data.
					// Even if this pair was a DTVCC packet start, only the first byte
					// contains header info, and the second byte is just packet data.
					this._cea708DataArray.push({
						pts,
						type: CcType.DTVCC_PACKET_DATA,
						value: ccData2,
						order: this._cea708DataArray.length,
					});
				}
			}
		}
	}

	// Decodes extracted closed caption data
	public decode(): Array<Cue> {
		const parsedClosedCaptions: Array<Cue> = [];

		// In some versions of Chrome, and other browsers, the default sorting
		// algorithm isn't stable. This comparator sorts on presentation
		// timestamp, and breaks ties on receive order (position in array)
		const stableComparator = (
			p1: Cea608ClosedCaptionPacket | Cea708ClosedCaptionByte,
			p2: Cea608ClosedCaptionPacket | Cea708ClosedCaptionByte,
		): number => p1.pts - p2.pts || p1.order - p2.order;

		this._cea608DataArray.sort(stableComparator);
		this._cea708DataArray.sort(stableComparator);

		// CEA-608 packets are just byte pairs. Decode all of them
		for (const cea608Packet of this._cea608DataArray) {
			const closedCaption: Cue | null = this.decodeCea608(cea608Packet);
			if (closedCaption) {
				parsedClosedCaptions.push(closedCaption);
			}
		}

		// CEA-708 packets are DTVCC packets composed of many byte pairs. Add all
		// byte pairs to the packet builder, and process + clear any ready packets
		for (const cea708Byte of this._cea708DataArray) {
			this._dtvccPacketBuilder.addByte(cea708Byte);
		}
		const dtvccPackets: Array<DtvccPacket> = this._dtvccPacketBuilder.getBuiltPackets();
		for (const dtvccPacket of dtvccPackets) {
			const closedCaptions: Array<Cue> = this.decodeCea708(dtvccPacket);
			if (closedCaptions.length > 0) {
				parsedClosedCaptions.push(...closedCaptions);
			}
		}

		// Clear all processed data
		this._dtvccPacketBuilder.clearBuiltPackets();
		this._cea608DataArray.length = 0;
		this._cea708DataArray.length = 0;

		return parsedClosedCaptions;
	}

	// Clears the decoder
	public clear(): void {
		this._badFrames = 0;
		this._cea608DataArray.length = 0;
		this._cea708DataArray.length = 0;
		this._dtvccPacketBuilder.clear();
		this.reset();

		// Clear all the CEA-708 services
		this._serviceNumberToCea708Service.forEach((service: Cea708Service) => {
			service.clear();
		});
	}
}

export default CeaDecoder;
