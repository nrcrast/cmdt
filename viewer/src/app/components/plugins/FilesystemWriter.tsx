import { getUrlFilePath, type Manifest, Plugin, type Report, type Segment } from "cmdt-shared";

async function mkdirp(dir: string, rootDir: FileSystemDirectoryHandle) {
	const parts = dir.split("/");
	let currentDir = rootDir;
	for (const part of parts) {
		currentDir = await currentDir.getDirectoryHandle(part, { create: true });
	}
	return currentDir;
}

export class FilesystemWriter extends Plugin {
	constructor(
		manifest: Manifest,
		report: Report,
		private outputDir: FileSystemDirectoryHandle,
	) {
		super(manifest, report, "filesystem-writer");
	}
	public override async processSegment(segment: Segment): Promise<void> {
		if (segment.media?.url) {
			const filename = segment.media.url.pathname.split("/").pop()!;
			const segmentDir = await mkdirp(getUrlFilePath(segment.media.url), this.outputDir);
			const data = await segment.media.getData();
			if (!data) {
				return;
			}
			const file = await segmentDir.getFileHandle(filename, { create: true });
			const writable = await file.createWritable();
			await writable.write(data);
			await writable.close();
		}
		if (segment.initSegment?.url) {
			const filename = segment.initSegment.url.pathname.split("/").pop()!;
			const segmentDir = await mkdirp(getUrlFilePath(segment.initSegment.url), this.outputDir);
			const data = await segment.initSegment.getData();
			if (!data) {
				return;
			}
			const file = await segmentDir.getFileHandle(filename, { create: true });
			const writable = await file.createWritable();
			await writable.write(data);
			await writable.close();
		}
	}
}
