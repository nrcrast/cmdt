// Fixture-based tests for the changelog parser and predicates.
// Run with: node --test scripts/check-changelog.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseChangelog, hasUnreleased, hasNonEmptyVersionSection } from "./check-changelog-lib.mjs";

const WELL_FORMED = `# Changelog

## [Unreleased]

### Added

## [0.5.1] - 2026-05-20

### Added

- Shiny new thing.

### Fixed

- A bug.

## [0.5.0] - 2026-05-17

### Changed

- Bumped minor.
`;

describe("parseChangelog", () => {
	it("parses unreleased plus released sections", () => {
		const parsed = parseChangelog(WELL_FORMED);
		assert.ok(parsed.unreleased);
		assert.equal(parsed.unreleased.version, "Unreleased");
		assert.equal(parsed.releases.length, 2);
		assert.equal(parsed.releases[0].version, "0.5.1");
		assert.equal(parsed.releases[0].date, "2026-05-20");
		assert.deepEqual(parsed.releases[0].sections.Added, ["Shiny new thing."]);
		assert.deepEqual(parsed.releases[0].sections.Fixed, ["A bug."]);
	});

	it("rejects multiple unreleased sections", () => {
		const src = `## [Unreleased]\n### Added\n## [Unreleased]\n### Added\n`;
		assert.throws(() => parseChangelog(src), /multiple '## \[Unreleased\]' sections/);
	});

	it("treats a section with no date as date=null", () => {
		const src = `## [Unreleased]\n## [0.5.1]\n### Added\n- Thing.\n`;
		const parsed = parseChangelog(src);
		assert.equal(parsed.releases[0].date, null);
	});

	it("recognizes bullets starting with -, *, or +", () => {
		const src = `## [Unreleased]\n### Added\n- one\n* two\n+ three\n`;
		const parsed = parseChangelog(src);
		assert.deepEqual(parsed.unreleased.sections.Added, ["one", "two", "three"]);
	});
});

describe("hasUnreleased", () => {
	it("returns true when Unreleased is present", () => {
		assert.equal(hasUnreleased(parseChangelog(WELL_FORMED)), true);
	});
	it("returns false when Unreleased is absent", () => {
		const src = `## [0.5.0] - 2026-05-17\n### Changed\n- Thing.\n`;
		assert.equal(hasUnreleased(parseChangelog(src)), false);
	});
});

describe("hasNonEmptyVersionSection", () => {
	it("returns true when at least one subsection has bullets", () => {
		const parsed = parseChangelog(WELL_FORMED);
		assert.equal(hasNonEmptyVersionSection(parsed.releases[0]), true);
	});

	it("returns false when all subsections are empty", () => {
		const src = `## [Unreleased]\n## [0.5.1] - 2026-05-20\n### Added\n### Fixed\n`;
		const parsed = parseChangelog(src);
		assert.equal(hasNonEmptyVersionSection(parsed.releases[0]), false);
	});

	it("returns false for undefined section", () => {
		assert.equal(hasNonEmptyVersionSection(undefined), false);
	});
});

describe("integration: pass case", () => {
	it("a release section with bullets passes the typical check", () => {
		const parsed = parseChangelog(WELL_FORMED);
		assert.equal(hasUnreleased(parsed), true);
		const target = parsed.releases.find((r) => r.version === "0.5.1");
		assert.ok(target);
		assert.ok(target.date);
		assert.equal(hasNonEmptyVersionSection(target), true);
	});
});
