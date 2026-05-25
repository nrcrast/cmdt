const hexToUint8 = (id: string): Uint8Array => {
	const hex: string = id.replace(/-/g, "");
	const data: Uint8Array = new Uint8Array(hex.length / 2);
	for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
		data[j] = Number.parseInt(hex.substring(i, i + 2), 16) & 0xff;
	}

	return data;
};

export default hexToUint8;
