import Mp4Parser from "../src/utils/mp4/parser.js";
import {Command} from "@commander-js/extra-typings";
import fs from "node:fs/promises";
import { ParsedBox } from "../src/utils/mp4/types.js";
import { v4 as randomUUID, parse as uuidParse } from "uuid";

const program = new Command().requiredOption("-f, --file <string>", "File to mangle").requiredOption("-o, --output <string>", "Output file");

program.parse();

const options = program.opts();

const data = await fs.readFile(options.file);

const parser = new Mp4Parser();

const dataArr = new Uint8Array(data);
let moovBox: ParsedBox | undefined;

let mutatedData: Uint8Array | undefined;

		parser
			.fullBox("pssh", (box: ParsedBox) => {
                if(mutatedData) {
                    Mp4Parser.parsePssh(box);
                    return;
                }
                const actualVersion = box.version;

                // Where the actual box content starts
                const contentStart = box.reader.getPosition();

                const versionStart = box.start + 8;

                const sizeStart = box.start;
                
                const kidCountStart = contentStart + 16;
                // Kid Count doesn't exist in version 0 so we need to insert it
                if(actualVersion === 0) {
                    // Add space for the kid count and a new UUID
                    const newSpaceNeeded = 4 + 16;
                    if(moovBox) {
                        box.reader.setUint32(moovBox!.start, moovBox!.size + newSpaceNeeded);
                    }
                    box.reader.setUint32(sizeStart, box.size + newSpaceNeeded);
                    box.size = box.size + newSpaceNeeded;
                    mutatedData = new Uint8Array(dataArr.length + newSpaceNeeded);
                    mutatedData.set(dataArr.subarray(0, kidCountStart), 0);
                    mutatedData.set(new Uint8Array([0x00, 0x00, 0x00, 0x01]), kidCountStart);
                    mutatedData.set(uuidParse(randomUUID()), kidCountStart + 4);
                    mutatedData.set(dataArr.subarray(kidCountStart, dataArr.length), kidCountStart + newSpaceNeeded);
                    mutatedData[versionStart] = 0x01;
                }

				const pssh = Mp4Parser.parsePssh(box);
                console.log(pssh);    
			})
			.box("moov", (box: ParsedBox) => {
                moovBox = box;
                return Mp4Parser.children(box);
            })
			.parse(dataArr.buffer);

await fs.writeFile(options.output, mutatedData ?? dataArr);
