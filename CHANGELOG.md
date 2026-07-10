# Changelog

All notable user-facing changes to CMDT are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

User-visible changes should be appended to the `[Unreleased]` section under the
appropriate subsection (`Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`,
`Security`). When the root `package.json` `version` field is bumped, rename the
`[Unreleased]` heading to `[X.Y.Z] - YYYY-MM-DD` and start a fresh empty
`[Unreleased]` block above it. CI enforces this on version-bump PRs.

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

### Deprecated

### Security

## [0.7.6] - 2026-07-10

### Fixed

- HLS: segment `startTime` values were off by a factor of 1000 (e.g. a segment
  6 seconds in showed `6016000` instead of `6016` ms), which made the viewer's
  segment timeline appear to use milliseconds where seconds were expected. The
  HLS playlist parser accumulated the running start time in milliseconds but then
  re-applied a seconds→milliseconds conversion when building each segment,
  double-converting every segment after the first. The same running value fed
  SCTE-35 `presentationTimeS` in milliseconds instead of seconds. Both now use
  the correct units, matching the DASH parser.

## [0.7.5] - 2026-07-09

### Fixed

- CLI: the packaged standalone binaries no longer crash with
  `TypeError: Cannot read properties of undefined (reading 'SCTE35')` when
  analyzing a manifest. The `scte35` imports in the DASH and HLS parsers used a
  default-import + destructure (`scte35Pkg.SCTE35`), which the CommonJS build's
  ESM-interop helper resolved to `scte35.default.SCTE35`. Because `scte35` sets
  `__esModule: true` but exposes no `default` export, that path was `undefined`
  only in the bundled/packaged CJS output — running from source or in the viewer
  (both ESM) was unaffected. Switched to a plain named import
  (`import { SCTE35 } from "scte35"`) so it resolves correctly across Node ESM,
  bundler CJS interop, and the browser build.

## [0.7.4] - 2026-07-08

### Fixed

- DASH periods that declare only a `duration` (no explicit `start`) now derive
  their start time from the running sum of preceding period durations instead
  of all collapsing to 0, so multi-period timelines render correctly.

## [0.7.3] - 2026-07-01

### Changed

- Pre-built release binaries are now built for x64 (Linux, Windows, macOS)
  instead of arm64, matching the platforms most users run.
- Relicensed the project under GPL-3.0; the published `license` fields now
  match the bundled `LICENSE` file.

## [0.7.2] - 2026-06-24

### Fixed

- DASH: parse on-demand `SegmentBase` representations (single-file renditions
  with `indexRange`/`Initialization`) so they report segments instead of zero.

## [0.7.1] - 2026-06-23

### Added

- Viewer: unified seafoam-green color palette with a light/dark/system theme
  toggle in the header.
- Viewer: header links to the GitHub repository and the project website.

### Fixed

- Docs: corrected the root README usage/options, output description, and report
  type snippets to match the current source; pointed `package.json` repository
  links at `nrcrast/cmdt`.

### Removed

- Removed the stale, unmaintained `shared/README.md` (an old copy of the root
  README that described removed CLI flags).

## [0.7.0] - 2026-06-23

### Added

- CLI: accept local manifest files — bare filesystem paths (e.g.
  `~/Downloads/master.mpd`) and `file://` URLs are now normalized and read
  directly, instead of crashing with an invalid-URL error.

### Fixed

- DASH: SCTE-35 markers using the standard capitalized `<scte35:Signal>` /
  `<scte35:Binary>` element casing are now parsed instead of being silently
  dropped (only lowercase was previously recognized).
- DRM: PSSH parsing no longer aborts with a "Stringified UUID is invalid"
  warning when a system ID or key ID is not a strict RFC-4122 UUID; these
  16-byte identifiers are now formatted without validation.

## [0.6.0] - 2026-06-23

### Added

- Viewer: interactive Timeline view powered by D3 — fit-to-screen by default
  with wheel-zoom and drag-pan (1x–64x), a hover crosshair with a time
  tooltip, per-type lanes (periods, video/audio/text) showing segment runs
  and gaps, and SCTE-35/EMSG markers with an adjustable gap threshold.
- Viewer: Report Summary panel surfacing key findings at a glance.
- Viewer: side-by-side rendition comparison tables for video, audio, text,
  and image representations.
- Viewer: WebVTT cues are now grouped into selectable per-rendition
  (per-language) tabs instead of a single merged table.

### Changed

- Viewer: EMSG presentation time and duration are now derived from each
  event's timescale and aligned to the segment presentation timeline (the
  presentation time offset is removed so markers and table rows line up with
  their segments); unknown-duration events (the 0xFFFFFFFF sentinel) display
  as N/A.
- Viewer: consolidated and standardized the representation tables across
  video/audio/text/image for a consistent UI.
- Shared: more precise time handling — seconds-to-milliseconds conversion no
  longer floors, avoiding rounding drift in segment, cue, and SCTE-35 times.

### Fixed

- Viewer: copy-to-clipboard now works in insecure contexts (e.g. plain-HTTP
  LAN access) via a fallback path.
- Viewer: removed TanStack Table column-safety console warnings.
- Viewer: timeline axis labels (e.g. "00s") are no longer clipped by card
  padding.
- Viewer: EMSG markers and table values now align with the segment timeline.
- Viewer: WebVTT cues from different language tracks are no longer mixed
  together in one table.
- Shared: gap detection is more robust — gaps are now evaluated
  independently of a segment's decode-time/duration metadata.

## [0.5.4] - 2026-05-25

### Fixed

- Viewer: fixed a `SCTE35 is not a constructor` runtime error in the
  production Next.js build by removing a stale
  `config.resolve.alias["scte35"] = false` webpack override in
  `viewer/next.config.ts`. The alias dated back to when scte35 was
  considered type-only, but `shared`'s HLS and DASH parsers call
  `new SCTE35()` at runtime, so stubbing the module to an empty value
  crashed the browser as soon as a manifest analysis ran. `next dev`
  (turbopack) ignores the `webpack:` config block, which is why the
  regression only reproduced in the built app.
- Shared: defensively switched the `scte35` imports in the HLS and DASH
  manifest parsers to the default-import + destructure pattern for parity
  with the existing `webvtt-parser` workaround, so the named import
  preserved by tsdown's ESM output keeps resolving correctly across both
  Node ESM and bundlers' CJS interop.

## [0.5.3] - 2026-05-25

### Changed

- Migrated `cli` and `shared` library builds from pkgroll to tsdown so all
  three published packages (`cli`, `shared`, `dash-ts`) share a single
  build pipeline producing dual CJS/ESM output with type declarations.
- Standardized the toolchain on pnpm 10 via `packageManager`, `engines.pnpm`,
  and `engine-strict=true` in `.npmrc`.
- Added a root `pnpm dev` watch script and Next.js workspace transpilation
  so editing `shared` or `dash-ts` triggers viewer HMR.

### Fixed

- CLI: resolved a Node ESM crash when importing `webvtt-parser` by using a
  default import and destructuring the `WebVTTParser` class, working around
  cjs-module-lexer's inability to detect the package's IIFE-assigned exports.
- dash-ts: corrected the `exports` map to reference the `.d.mts`/`.d.cts`
  declaration files actually emitted by the build, restoring type resolution
  for downstream consumers.

## [0.5.2] - 2026-05-20
### Changed
- Refactoring and directory structure cleanup

## [0.5.1] - 2026-05-20

### Added
- Added a changelog to the viewer

## [0.5.0] - 2026-05-17

### Changed

- Minor version bump consolidating the HLS, SCTE-35, and download-mode work
  released in the 0.4.x series.

## [0.4.5] - 2026-05-17

### Added

- Expanded HLS support including SCTE-35 markers and WebVTT subtitles.
- HLS-focused test coverage to guard the new parsing paths.

## [0.4.4] - 2026-05-15

### Added

- Download modes for the manifest analyzer, letting users choose how much of a
  stream to fetch when running a diagnostic.

## [0.4.3] - 2026-05-15

### Changed

- Bundled the SCTE-35 parser with the viewer build so DASH analysis works in
  the hosted app without additional setup.

## [0.4.2] - 2026-05-15

### Added

- SCTE-35 marker extraction for DASH streams.

### Changed

- Updated DASH TypeScript typings used by the analyzer.

## [0.4.1 and earlier] - 2026-04-20

- Earlier 0.x.x releases predate this changelog. See the
  [GitHub Releases page](https://github.com/NBCUDTC/cmdt/releases) for the
  auto-generated commit history of those versions, which covered the initial
  CLI, plugin architecture, content-protection parsing, EMSG handling, the
  web analyzer, and the first cut of the report viewer.
