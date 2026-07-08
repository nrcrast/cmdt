# Tooling & Conventions

## Formatting & lint (Biome)

Single root `biome.json`. Use **tabs**, **double quotes**, line width **120**.
`console` is banned (`suspicious/noConsole: error`) — log via `tslog` in
`shared`/`dash-ts` and the `winston` logger in `cli`. Run `pnpm lint` and
`pnpm format` (or `:fix` variants). Imports are ESM and use explicit `.js`
extensions.

## Dependencies (pnpm workspaces)

- Internal packages: reference with `workspace:*` (e.g. `cmdt-shared`).
- Shared external versions: use `catalog:` and define the version once in
  `pnpm-workspace.yaml` (`@biomejs/biome`, `@types/node`, `axios`, `typescript`,
  `vitest`). Don't hardcode a version that lives in the catalog.

## Commits

Conventional Commits with optional scope: `fix(dash): …`, `feat: …`, `chore: …`.

## Versioning (CI-enforced on PRs)

Only the **root** `package.json` `version` is the source of truth; child
packages stay at `0.0.0` (except the independently published `dash-ts`). To bump:

1. Increment `version` in the root `package.json`.
2. In `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` and add a
   fresh empty `[Unreleased]` block above it, with entries under the right
   subsection (`Added`/`Changed`/`Fixed`/…).

`scripts/check-changelog.mjs --require-bump` gates this on PRs. PRs touching
only `dash-ts/`, `scripts/`, or `.github/workflows/` are exempt. The viewer's
`changelog.generated.ts` is built from `CHANGELOG.md` and is not committed.
