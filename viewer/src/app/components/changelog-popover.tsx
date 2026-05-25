"use client";
import Link from "next/link";
import { type ChangelogSection, getRecentReleases, isNonEmpty, versionAnchorId } from "@/lib/changelog";

const POPOVER_RELEASE_COUNT = 3;
const BULLETS_PER_SECTION = 5;

function ReleaseSummary({ release }: { release: ChangelogSection }) {
	const subsections = Object.entries(release.sections).filter(([, bullets]) => bullets.length > 0);
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold leading-none">
				v{release.version}
				{release.date && <span className="ml-2 text-xs font-normal text-muted-foreground">{release.date}</span>}
			</h3>
			{subsections.map(([name, bullets]) => (
				<div key={name} className="space-y-1">
					<p className="text-xs font-medium text-muted-foreground">{name}</p>
					<ul className="list-disc space-y-0.5 pl-4 text-xs">
						{bullets.slice(0, BULLETS_PER_SECTION).map((bullet) => (
							<li key={`${name}-${bullet}`}>{bullet}</li>
						))}
						{bullets.length > BULLETS_PER_SECTION && (
							<li className="list-none text-muted-foreground">+{bullets.length - BULLETS_PER_SECTION} more</li>
						)}
					</ul>
				</div>
			))}
		</div>
	);
}

export function ChangelogPopoverContent() {
	const releases = getRecentReleases(POPOVER_RELEASE_COUNT).filter(isNonEmpty);
	return (
		<div className="space-y-4">
			<div className="flex items-baseline justify-between">
				<p className="text-sm font-semibold">What&apos;s new</p>
				<Link
					href="/changelog"
					className="text-xs text-muted-foreground underline-offset-4 hover:underline"
					id={`${versionAnchorId("changelog-popover-link")}`}
				>
					View full changelog →
				</Link>
			</div>
			{releases.length === 0 ? (
				<p className="text-sm text-muted-foreground">No release notes yet.</p>
			) : (
				<div className="space-y-4">
					{releases.map((release) => (
						<ReleaseSummary key={release.version} release={release} />
					))}
				</div>
			)}
		</div>
	);
}
