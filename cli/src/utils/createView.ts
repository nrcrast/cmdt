const createView = (
	data: DataView | ArrayBuffer | Uint8Array | BufferSource,
	Type: DataViewConstructor | Uint8ArrayConstructor,
	offset = 0,
	length: number = Number.POSITIVE_INFINITY,
): DataView | Uint8Array => {
	let buffer: ArrayBuffer;
	if (data instanceof ArrayBuffer) {
		buffer = data;
	} else {
		buffer = data.buffer as ArrayBuffer;
	}

	const dataOffset: number = "byteOffset" in data ? data.byteOffset : 0;
	// Absolute end of the |data| view within |buffer|.
	const dataEnd: number = dataOffset + data.byteLength;
	// Absolute start of the result within |buffer|.
	const rawStart: number = dataOffset + offset;
	const start: number = Math.max(0, Math.min(rawStart, dataEnd));
	// Absolute end of the result within |buffer|.
	const end: number = Math.min(start + Math.max(length, 0), dataEnd);

	// @ts-expect-error
	return new Type(buffer, start, end - start);
};

export default createView;
