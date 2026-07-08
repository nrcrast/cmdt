# Manifest Parsing

Applies to the parsing subsystem: `shared/src/manifest-parsers/**`,
`shared/src/manifest.ts`, and `dash-ts/**`.

Parsing is two layers. Keep them separate:

1. **Raw layer (`dash-ts`)** — mirrors the MPD 1:1. Fields are the manifest's
   own values; a missing attribute stays `undefined`. Do **not** put CMDT
   defaults or computed values here.
2. **Normalized layer (`shared/src/manifest-parsers/dash/dash.ts` and
   `hls/hls.ts`)** — transforms raw into the DASH/HLS-agnostic model in
   `shared/src/manifest.ts` (`Manifest`, `Period`, `Representation`, `Segment`).
   Both parsers implement the `ManifestParser` abstract class and must emit the
   same shared shape. Add new cross-format fields to `manifest.ts`, not to
   format-specific types.

## Derived vs declared values

Anything the manifest doesn't state explicitly is computed in the normalized
layer. Prefer spec-correct derivation over defaulting to `0`/empty.

Example (real bug): DASH `Period@start` is optional. When absent, a period's
start is the running sum of preceding periods' durations — not `0`. See
`getPeriodStartSeconds` / `getPeriodDurationSeconds` in the DASH parser.

## Analysis vs parsing

Parsers only build the model. Segment/media analysis belongs in `Plugin`
subclasses (`shared/src/plugins/`): they register via their constructor and
implement `processSegment` / `finalize`.

## Tests

Vitest, using real manifests in `shared/test/manifests/` loaded with
`getTestFile`. Small manifests use `toMatchSnapshot`; large ones use explicit
assertions (see `hulu-vod`, `discovery`, `paramount` tests) to avoid huge
snapshots. Run `pnpm test` in the package to write/refresh snapshots locally.
