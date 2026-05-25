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
