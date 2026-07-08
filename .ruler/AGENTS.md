# CMDT Architecture

CMDT (Common Media Diagnostic Tool) analyzes DASH/HLS streaming manifests and
their media segments, then produces diagnostic reports. It is a pnpm-workspace
monorepo (Node >=22, pnpm >=10). Four packages:

- **`dash-ts/`** — Standalone MPEG-DASH XML parser, published to npm (its own
  semver, currently 1.0.0). Produces the **raw** MPD model: typed structures
  that mirror the manifest verbatim (absent attributes are `undefined`). No CMDT
  business logic. Deps: `xml2js`, `iso8601-duration`.
- **`shared/`** (`cmdt-shared`) — The core engine consumed by both `cli` and
  `viewer`. Owns the DASH/HLS-agnostic normalized model (`src/manifest.ts`), the
  DASH + HLS parsers (`src/manifest-parsers/`), the segment downloader, DRM/PSSH
  parsing (`src/drm/`), the plugin framework (`src/plugins/`), and the report
  (`src/report.ts`). Public surface is re-exported from `src/index.ts`.
- **`cli/`** (`cmdt-cli`) — Commander-based CLI. Parses a manifest via `shared`,
  downloads segments, runs plugins, writes artifacts to the filesystem. Packaged
  to standalone binaries with `@yao-pkg/pkg`. Logs via `winston`.
- **`viewer/`** — Next.js 15 / React 19 static app (Tailwind v4, Radix UI, d3)
  that visualizes manifests/reports in the browser. Depends on `shared`.

## Data flow

`getManifestParser(uri)` selects DASH (`.mpd`) vs HLS → `ManifestParser.parse()`
returns a normalized `Manifest` → `Plugin` subclasses analyze segments and
`finalize()` into a `Report` + artifacts. `cli` and `viewer` are thin frontends
over this same `shared` pipeline.
