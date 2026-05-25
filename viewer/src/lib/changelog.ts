// Typed accessor over the changelog parsed at build time from the repo root's
// CHANGELOG.md. The raw data lives in changelog.generated.ts (gitignored) and
// is produced by scripts/build-changelog.mjs.
import { CHANGELOG_DATA } from "./changelog.generated";

export type ChangelogSection = {
	version: string;
	date: string | null;
	sections: Record<string, string[]>;
};

export type ParsedChangelog = {
	unreleased: ChangelogSection | null;
	releases: ChangelogSection[];
};

/** All released entries, most-recent first (as authored in CHANGELOG.md). */
export function getReleases(): ChangelogSection[] {
	return CHANGELOG_DATA.releases;
}

/** The Unreleased section, or null if not present. */
export function getUnreleased(): ChangelogSection | null {
	return CHANGELOG_DATA.unreleased;
}

/** The version of the most recent release, or null if none exist. */
export function getCurrentVersion(): string | null {
	return CHANGELOG_DATA.releases[0]?.version ?? null;
}

/**
 * Best-effort semver comparison: returns >0 if a > b, <0 if a < b, 0 if equal.
 * Non-numeric components compare lexicographically; pre-release suffixes are
 * ignored. Sufficient for "is this version newer than lastSeen?".
 */
export function compareSemver(a: string, b: string): number {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split("-")[0]
			.split(".")
			.map((n) => Number.parseInt(n, 10) || 0);
	const ap = parse(a);
	const bp = parse(b);
	const length = Math.max(ap.length, bp.length);
	for (let i = 0; i < length; i++) {
		const av = ap[i] ?? 0;
		const bv = bp[i] ?? 0;
		if (av !== bv) return av - bv;
	}
	return 0;
}

/**
 * Returns released entries strictly newer than `since`. If `since` is null or
 * unparseable, returns all releases.
 */
export function getReleasesSince(since: string | null): ChangelogSection[] {
	if (!since) return CHANGELOG_DATA.releases;
	return CHANGELOG_DATA.releases.filter((r) => compareSemver(r.version, since) > 0);
}

/** Returns the most recent N released entries. */
export function getRecentReleases(n: number): ChangelogSection[] {
	return CHANGELOG_DATA.releases.slice(0, n);
}

/** Returns true if `section` has at least one non-empty subsection. */
export function isNonEmpty(section: ChangelogSection | null): boolean {
	if (!section) return false;
	return Object.values(section.sections).some((bullets) => bullets.length > 0);
}

/** Stable URL-anchor id for a release version, e.g. "0.5.1" -> "v0-5-1". */
export function versionAnchorId(version: string): string {
	return `v${version.replace(/\./g, "-").replace(/[^a-zA-Z0-9-]/g, "-")}`;
}
