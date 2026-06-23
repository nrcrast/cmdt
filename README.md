# CMDT (Common Media Diagnostics Tool)
CMDT is a CLI tool designed to help video engineers diagnose issues with DASH/HLS manifests and the (mp4) content within! Given a manifest, it will perform the following tasks:
- Parse the manifest
- Download segments for all renditions (audio, video, thumbnails, captions) to filesystem
- Parse captions (CEA-608/708 and WebVTT) from media files and write to filesystem
- Parse EMSG boxes from media files and write to filesystem
- Extract PSSH / content protection information
- Check for CEA caption inconsistencies between video renditions
- Check for gaps between segments

How much is downloaded and analyzed depends on the `--mode` option (see below).

# Installation
## Pre-built binaries
Pre-built binaries for Linux, Windows, and MacOS are built as part of the release process. The latest release can be found [here](https://github.com/nrcrast/cmdt/releases/latest).

## Running from source
This is a typical node repo, for the most part. Once cloned, run the following:
```
nvm use
npm i -g pnpm
pnpm i
pnpm build
```

You must run the full build once before attempting to run the CLI.

At this point, you should be able to run `cd cli && pnpm start -h` and get the help output from the application. 

# Usage
```
Options:
  -m, --manifest <string>     Manifest URI. Can also be a local path.
  -b, --base-url <string>     Base URL for relative URIs in manifest, if using local manifest.
  -o, --output <string>       Output directory (default: "download")
  -d, --mode <downloadMode>   Download mode (choices: "manifest-only", "quick", "full", default: "full")
                                manifest-only — Parse the manifest; skip all segment downloads.
                                quick — Download init segments fully and only the head of each media segment.
                                full — Download every byte of every segment.
  -l, --log-level <logLevel>  Log Level (choices: "off", "error", "info", "debug", default: "info")
  -p, --log-periods           Print a table of periods in DASH manifests
  -h, --help                  display help for command
```

Typical usage is something like:
```
pnpm start -m "https://my-site/manifest.mpd" -o output
```

If you're running a pre-built binary, replace `pnpm start` with `./cmdt`. 

After running the tool, all output will be in a directory called `output`, as specified by the `-o` option. This includes a parsed `manifest.json`, a `debug.log`, per-plugin artifacts (captions, EMSG, etc.), and the full report as `report.cmdt`.

## Viewer
The tool writes the full report to a `report.cmdt` file. This is human readable (JSON), but there's a graphical tool that can be helpful for viewing the data.

This tool lives in the 'viewer' directory, but a hosted version can be found [here](https://cra.st/cmdt).

## Report format
```typescript
export type RawReport = {
	missingCues: {
		[representation: RepresentationId]: {
			[cue: string]: Array<RepresentationId>;
		};
	};
	duplicateThumbnails: {
		[representation: RepresentationId]: {
			[thumbnail: string]: Set<RepresentationId>;
		};
	};
	gaps: {
		[mediaType: string]: {
			[representation: string]: Array<{ expectedStartTime: number; previousSegment: Segment; segment: Segment }>;
		};
	};
	decodeTimeMismatches: Array<Segment>;
	durationMismatches: Array<Segment>;
	emsgs: {
		[representation: RepresentationId]: {
			segment: Segment;
			emsgs: Array<Emsg>;
		};
	};
	manifest: Omit<Manifest, "video" | "audio" | "images" | "text" | "raw"> & {
		video: Array<Representation>;
		audio: Array<Representation>;
		images: Array<Representation>;
		text: Array<Representation>;
	};
	captions?: {
		[stream: string]: Array<Cue>;
	};
	textCues: {
		[representation: RepresentationId]: {
			language?: string;
		} & Pick<VTTData, "cues" | "styles">;
	};
	mismatchedContentProtection: Array<MismatchedContentProtectionEntry>;
};

export type Manifest = {
	url: URL;
	video: UniqueRepresentationMap;
	audio: UniqueRepresentationMap;
	images: UniqueRepresentationMap;
	text: UniqueRepresentationMap;
	scte35?: Array<Scte35Marker>;
	contentProtection: Array<ContentProtection>;
	captionStreamToLanguage: Record<string, string>;
	periods: Array<Period>;
	raw: string;
};
```

For more detailed info on `Manifest` content, see source.

# Contributing

## Changelog

User-facing changes are tracked in [`CHANGELOG.md`](./CHANGELOG.md) following the
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format. The viewer
bundles this file at build time and surfaces it from the version badge in the
header and on the `/changelog` route.

Every PR MUST bump the root `package.json` `version` field and add (or finalize)
a matching `CHANGELOG.md` section. Every merge to `main` triggers a release —
deploy, package, tag, and GitHub Release — keyed off whatever version is in
`package.json` at that commit. CI (`scripts/check-changelog.mjs --require-bump`,
run from `.github/workflows/pr.yaml`) blocks PRs that don't bump.

Append a bullet under the appropriate subsection of `## [Unreleased]`. The
available subsections are:

```markdown
## [Unreleased]

### Added
- New capability for end users.

### Changed
- Behavior that existing users will notice.

### Fixed
- User-visible bug that was repaired.

### Removed
- Capability that no longer ships.

### Deprecated
- Capability still present but slated for removal.

### Security
- Vulnerability fixes worth flagging.
```

When you bump the version in `package.json`, rename the existing
`## [Unreleased]` heading to `## [X.Y.Z] - YYYY-MM-DD` and insert a fresh empty
`## [Unreleased]` block above it.
