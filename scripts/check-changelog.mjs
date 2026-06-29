#!/usr/bin/env node
// Verifies that root package.json version bumps are accompanied by a matching
// CHANGELOG.md section. Runs in two modes:
//   --base=<ref>      compare working-tree package.json against <ref>:package.json
//                     (PR mode; <ref> is typically $GITHUB_BASE_REF)
//   --release         compare HEAD:package.json against HEAD~1:package.json
//                     (release mode; defense-in-depth on push to main)
// Additional flag:
//   --require-bump    fail if the version is unchanged relative to the comparison
//                     ref (PR policy: every PR must bump the root version)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	parseChangelog,
	hasNonEmptyVersionSection,
	hasUnreleased,
	isDashTsOnly,
} from "./check-changelog-lib.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
	const args = { base: null, release: false, requireBump: false };
	for (const arg of argv) {
		if (arg.startsWith("--base=")) args.base = arg.slice("--base=".length);
		else if (arg === "--release") args.release = true;
		else if (arg === "--require-bump") args.requireBump = true;
		else if (arg === "--help" || arg === "-h") args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function printUsage() {
	process.stderr.write(
		"Usage: check-changelog.mjs (--base=<ref> | --release) [--require-bump]\n" +
			"  --base=<ref>     Compare working-tree package.json against <ref>:package.json\n" +
			"  --release        Compare HEAD against HEAD~1 (release-time guard)\n" +
			"  --require-bump   Fail when the version is unchanged (PR policy)\n",
	);
}

function readVersionAtRef(ref) {
	try {
		const json = execFileSync("git", ["show", `${ref}:package.json`], {
			cwd: REPO_ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return JSON.parse(json).version ?? null;
	} catch (err) {
		throw new Error(`Failed to read package.json at ${ref}: ${err.message}`);
	}
}

function readVersionAtPath(path) {
	const json = readFileSync(path, "utf8");
	return JSON.parse(json).version ?? null;
}

// Returns the list of files that differ between <ref> and the working tree, or
// null if the diff cannot be computed (in which case callers should not relax
// any policy based on the file list).
function changedFilesSinceRef(ref) {
	try {
		const out = execFileSync("git", ["diff", "--name-only", ref, "--"], {
			cwd: REPO_ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return out
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	} catch {
		return null;
	}
}

function fail(message) {
	process.stderr.write(`changelog check failed: ${message}\n`);
	process.exit(1);
}

function main() {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (err) {
		process.stderr.write(`${err.message}\n`);
		printUsage();
		process.exit(2);
	}
	if (args.help || (!args.base && !args.release)) {
		printUsage();
		process.exit(args.help ? 0 : 2);
	}

	const changelogPath = resolve(REPO_ROOT, "CHANGELOG.md");
	if (!existsSync(changelogPath)) {
		fail(`CHANGELOG.md not found at repository root (${changelogPath})`);
	}
	const changelog = readFileSync(changelogPath, "utf8");
	let parsed;
	try {
		parsed = parseChangelog(changelog);
	} catch (err) {
		fail(`CHANGELOG.md is malformed: ${err.message}`);
	}

	if (!hasUnreleased(parsed)) {
		fail(
			"CHANGELOG.md is missing an '## [Unreleased]' section. " +
				"Add one at the top of the file (see Keep a Changelog 1.1.0).",
		);
	}

	let priorVersion;
	let currentVersion;
	if (args.release) {
		priorVersion = readVersionAtRef("HEAD~1");
		currentVersion = readVersionAtRef("HEAD");
	} else {
		priorVersion = readVersionAtRef(args.base);
		currentVersion = readVersionAtPath(resolve(REPO_ROOT, "package.json"));
	}

	if (priorVersion === currentVersion) {
		if (args.requireBump) {
			const changedFiles = args.base ? changedFilesSinceRef(args.base) : null;
			if (isDashTsOnly(changedFiles)) {
				process.stdout.write(
					`changelog check: version unchanged (${currentVersion}); ` +
						`changes are confined to dash-ts/, which is versioned independently; ok\n`,
				);
				return;
			}
			fail(
				`root package.json 'version' (${currentVersion}) is unchanged relative to ${args.base ?? "HEAD~1"}. ` +
					`Every PR must bump the version (and add a matching '## [<new-version>] - <today>' section to CHANGELOG.md). ` +
					`(PRs touching only dash-ts/ are exempt.)`,
			);
		}
		process.stdout.write(`changelog check: version unchanged (${currentVersion}); ok\n`);
		return;
	}

	if (!currentVersion) {
		fail(`package.json has no 'version' field`);
	}

	const section = parsed.releases.find((r) => r.version === currentVersion);
	if (!section) {
		fail(
			`package.json version changed from ${priorVersion} to ${currentVersion}, ` +
				`but CHANGELOG.md has no '## [${currentVersion}] - YYYY-MM-DD' section. ` +
				`Rename '## [Unreleased]' to '## [${currentVersion}] - <today>' and add a fresh empty Unreleased above it.`,
		);
	}
	if (!section.date) {
		fail(
			`CHANGELOG.md section '## [${currentVersion}]' is missing a date. ` +
				`Use the format '## [${currentVersion}] - YYYY-MM-DD'.`,
		);
	}
	if (!hasNonEmptyVersionSection(section)) {
		fail(
			`CHANGELOG.md section '## [${currentVersion}] - ${section.date}' has no non-empty ` +
				`subsection. Add at least one bullet under Added/Changed/Fixed/Removed/Deprecated/Security.`,
		);
	}

	process.stdout.write(
		`changelog check: ${priorVersion} -> ${currentVersion} matched by '[${currentVersion}] - ${section.date}'; ok\n`,
	);
}

main();
