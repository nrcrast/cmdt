import type { ILogObj, Logger } from "tslog";
import createView from "../create-view.js";
import uint8ToString from "../uint8-to-string.js";
import { Endian, Size } from "./types.js";

class DataViewReader {
	private _position = 0;
	private _dataView: DataView;
	private _littleEndian: boolean;

	constructor(
		data: Uint8Array,
		endianess: Endian,
		private logger?: Logger<ILogObj>,
	) {
		this._dataView = createView(data, DataView) as DataView;
		this._littleEndian = endianess === Endian.LITTLE;
	}

	private overflowError(): void {
		this.onError("JS integer overflow");
	}
	private outOfBoundsError(): void {
		this.onError("Buffer position out of bounds");
	}

	private onError(message: string): void {
		this.logger?.debug(message);
	}

	public getLength(): number {
		return this._dataView.byteLength;
	}

	public getPosition(): number {
		return this._position;
	}

	public setPosition(position: number): void {
		this._position = position;
	}

	public hasMoreData(): boolean {
		return this.getPosition() < this.getLength();
	}

	public readUint8(): number {
		try {
			const value: number = this._dataView.getUint8(this._position);
			this._position += Size.UINT8;

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public readUint16(): number {
		try {
			const value: number = this._dataView.getUint16(this._position, this._littleEndian);
			this._position += Size.UINT16;

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public readUint32(): number {
		try {
			const value: number = this._dataView.getUint32(this._position, this._littleEndian);
			this._position += Size.UINT32;

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public readInt32(): number {
		try {
			const value: number = this._dataView.getInt32(this._position, this._littleEndian);
			this._position += Size.UINT32;

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public readUint64(): number {
		let low: number;
		let high: number;

		try {
			if (this._littleEndian) {
				low = this._dataView.getUint32(this._position, true);
				high = this._dataView.getUint32(this._position + Size.UINT32, true);
			} else {
				high = this._dataView.getUint32(this._position, false);
				low = this._dataView.getUint32(this._position + Size.UINT32, false);
			}
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}

		if (high > 0x1fffff) {
			throw this.overflowError();
		}

		this._position += Size.UINT64;

		return high * 2 ** 32 + low;
	}

	public readBytes(bytes: number): Uint8Array {
		if (this._position + bytes > this.getLength()) {
			throw this.outOfBoundsError();
		}

		const value: Uint8Array = createView(this._dataView, Uint8Array, this._position, bytes) as Uint8Array;
		this._position += bytes;

		return value;
	}

	public readTerminatedString(): string {
		const start: number = this._position;
		while (this.hasMoreData()) {
			const value: number = this._dataView.getUint8(this._position);
			if (value === 0) {
				break;
			}
			this._position += Size.NUL_BYTE;
		}

		const value: Uint8Array = createView(this._dataView, Uint8Array, start, this._position - start) as Uint8Array;

		// Skip string termination.
		this._position += Size.NUL_BYTE;

		return uint8ToString(value);
	}

	public skip(bytes: number): void {
		if (this._position + bytes > this.getLength()) {
			throw this.outOfBoundsError();
		}
		this._position += bytes;
	}

	public typeToString(type: number): string {
		const name: string = String.fromCharCode((type >> 24) & 0xff, (type >> 16) & 0xff, (type >> 8) & 0xff, type & 0xff);

		return name;
	}

	public getUint16(offset: number): number {
		try {
			const value: number = this._dataView.getUint16(offset, this._littleEndian);

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public getInt32(offset: number): number {
		try {
			const value: number = this._dataView.getInt32(offset, this._littleEndian);

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public getUint32(offset: number): number {
		try {
			const value: number = this._dataView.getUint32(offset, this._littleEndian);

			return value;
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public getUint64(offset: number): number {
		let low: number;
		let high: number;

		try {
			if (this._littleEndian) {
				low = this._dataView.getUint32(offset, true);
				high = this._dataView.getUint32(offset + Size.UINT32, true);
			} else {
				high = this._dataView.getUint32(offset, false);
				low = this._dataView.getUint32(offset + Size.UINT32, false);
			}
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}

		if (high > 0x1fffff) {
			throw this.overflowError();
		}

		return high * 2 ** 32 + low;
	}

	public setUint8(offset: number, value: number): void {
		try {
			this._dataView.setUint8(offset, value);
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public setUint16(offset: number, value: number): void {
		try {
			this._dataView.setUint16(offset, value, this._littleEndian);
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public setInt32(offset: number, value: number): void {
		try {
			this._dataView.setInt32(offset, value, this._littleEndian);
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public setUint32(offset: number, value: number): void {
		try {
			this._dataView.setUint32(offset, value, this._littleEndian);
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}

	public setUint64(offset: number, value: number): void {
		const high: number = Math.floor(value / 2 ** 32);
		const low: number = value & 0xffffffff;
		try {
			if (this._littleEndian) {
				this._dataView.setUint32(offset, low, true);
				this._dataView.setUint32(offset + Size.UINT32, high, true);
			} else {
				this._dataView.setUint32(offset, high, false);
				this._dataView.setUint32(offset + Size.UINT32, low, false);
			}
			// biome-ignore lint/correctness/noUnusedVariables: do not care about the specific error here
		} catch (e) {
			throw this.outOfBoundsError();
		}
	}
}

export default DataViewReader;
