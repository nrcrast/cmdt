// Parser and predicates for CHANGELOG.md following Keep a Changelog 1.1.0.
// Shared between the CI check (scripts/check-changelog.mjs) and the viewer
// build-time ingestion (scripts/build-changelog.mjs).

const VERSION_HEADING = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const SUBSECTION_HEADING = /^###\s+(.+?)\s*$/;
const KNOWN_SUBSECTIONS = ["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security"];

/**
 * Parse a CHANGELOG.md string into a structured object.
 *
 * Result shape:
 *   {
 *     unreleased: Section | null,
 *     releases: Array<{ version: string, date: string | null, sections: Record<string, string[]> }>
 *   }
 *
 * Each section's `sections` map keys are subsection names (e.g. "Added") and
 * values are arrays of trimmed bullet strings. Bullets are recognized as lines
 * starting with `- `, `* `, or `+ `. Empty subsections appear with empty arrays.
 */
export function parseChangelog(source) {
	const lines = source.split(/\r?\n/);
	const releases = [];
	let unreleased = null;
	let currentSection = null;
	let currentSubsection = null;

	const startSection = (version, date) => {
		const section = { version, date: date ?? null, sections: {} };
		if (version === "Unreleased") {
			if (unreleased) throw new Error("multiple '## [Unreleased]' sections");
			unreleased = section;
		} else {
			releases.push(section);
		}
		currentSection = section;
		currentSubsection = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const versionMatch = line.match(VERSION_HEADING);
		if (versionMatch) {
			const [, version, date] = versionMatch;
			startSection(version, date);
			continue;
		}
		const subsectionMatch = line.match(SUBSECTION_HEADING);
		if (subsectionMatch && currentSection) {
			currentSubsection = subsectionMatch[1];
			if (!(currentSubsection in currentSection.sections)) {
				currentSection.sections[currentSubsection] = [];
			}
			continue;
		}
		if (currentSection && currentSubsection) {
			const trimmed = line.trim();
			if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("+ ")) {
				currentSection.sections[currentSubsection].push(trimmed.slice(2).trim());
			} else if (trimmed.length > 0 && !trimmed.startsWith("#")) {
				// Continuation lines (e.g., wrapped bullets) are appended to the last bullet.
				const bullets = currentSection.sections[currentSubsection];
				if (bullets.length > 0) {
					bullets[bullets.length - 1] += ` ${trimmed}`;
				}
			}
		}
	}

	return { unreleased, releases };
}

/** True iff the parsed changelog contains an '## [Unreleased]' section. */
export function hasUnreleased(parsed) {
	return parsed.unreleased !== null;
}

/** True iff `section` has at least one bullet under at least one subsection. */
export function hasNonEmptyVersionSection(section) {
	if (!section) return false;
	return Object.values(section.sections).some((bullets) => bullets.length > 0);
}

/** Known canonical subsection names in Keep a Changelog 1.1.0 order. */
export function knownSubsections() {
	return [...KNOWN_SUBSECTIONS];
}
