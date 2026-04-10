import { Manifest, Representation, Segment, Report, Plugin, getUrlFilePath } from "cmdt-shared";

import { getOpts } from "../../cli-opts.js";
import fs from "fs/promises";
import path from "node:path";
import { mkdirp } from "mkdirp";

export class FilesystemWriter extends Plugin {

    constructor(manifest: Manifest, report: Report) {
        super(manifest, report, "filesystem-writer");
    }
    public override async processSegment(segment: Segment, representation: Representation): Promise<void> {
        if(segment.media?.url) {
            const segmentFilePath = path.resolve(getOpts().output, getUrlFilePath(segment.media.url));
            const data = await segment.media.getData();
            if(!data) {
                return;
            }
            await mkdirp(path.dirname(segmentFilePath))
            await fs.writeFile(segmentFilePath, Buffer.from(data));
        }
        if(segment.initSegment?.url) {
            const segmentFilePath = path.resolve(getOpts().output, getUrlFilePath(segment.initSegment.url));
            const data = await segment.initSegment.getData();
            if(!data) {
                return;
            }
            await mkdirp(path.dirname(segmentFilePath))
            await fs.writeFile(segmentFilePath, Buffer.from(data));
        }
    }
}