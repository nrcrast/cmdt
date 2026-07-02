import fs from "node:fs/promises";
import path from "node:path";

const __dirname = import.meta.dirname;

export async function getTestFile(filePath: string): Promise<string> {
	const data = await fs.readFile(path.resolve(__dirname, filePath), "utf-8");
	return data;
}

export async function writeTestFile(filePath: string, data: string): Promise<void> {
	await fs.mkdir(path.dirname(path.resolve(__dirname, filePath)), { recursive: true });
	await fs.writeFile(path.resolve(__dirname, filePath), data);
}

export async function getBinaryTestFile(filePath: string): Promise<Buffer> {
	const data = await fs.readFile(path.resolve(__dirname, filePath));
	return data;
}
