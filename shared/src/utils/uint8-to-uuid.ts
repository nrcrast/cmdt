const byteToHex: Array<string> = [];
for (let i = 0; i < 256; i++) {
	byteToHex.push((i + 0x100).toString(16).slice(1));
}

/**
 * Formats 16 bytes as a canonical UUID string without RFC-4122 validation.
 *
 * DRM system IDs and key IDs are arbitrary 16-byte identifiers and are not
 * guaranteed to be valid RFC-4122 UUIDs (correct version/variant nibbles), so
 * uuid's validating `stringify` can throw on otherwise well-formed PSSH data.
 * @param bytes - The byte array to format
 * @param offset - Offset into the array to start reading 16 bytes from
 * @returns The lowercased UUID string representation
 */
const uint8ToUuid = (bytes: Uint8Array, offset = 0): string => {
	let hex = "";
	for (let i = 0; i < 16; i++) {
		hex += byteToHex[bytes[offset + i] ?? 0] ?? "00";
	}
	return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)]
		.join("-")
		.toLowerCase();
};

export default uint8ToUuid;
