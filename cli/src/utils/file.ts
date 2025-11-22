import fs from "node:fs/promises";

/**
 * Check if a file is readable and writable without throwing an error.
 * @param filePath - The path to the file to check
 * @returns true if the file is readable and writable, false otherwise
 */
export async function canAccessFile(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
