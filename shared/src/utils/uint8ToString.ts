const uint8ToString = (uint8: Uint8Array): string => {
	let modifiedUuint8 = uint8;
	// If present, strip off the UTF-8 BOM.
	if (uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
		modifiedUuint8 = uint8.subarray(3);
	}

	let decoded = "";
	const utf8decoder: TextDecoder = new TextDecoder();
	decoded = utf8decoder.decode(modifiedUuint8);
	if (decoded.includes("\uFFFD")) {
		return "";
	}

	return decoded;
};

export default uint8ToString;
