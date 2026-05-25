import Link from "next/link";
import { Button } from "@/components/ui/button";
import { H1, H2 } from "@/components/ui/typography";
import { type ChangelogSection, getReleases, getUnreleased, isNonEmpty, versionAnchorId } from "@/lib/changelog";

function Section({ section, anchor }: { section: ChangelogSection; anchor?: string }) {
	const subsections = Object.entries(section.sections).filter(([, bullets]) => bullets.length > 0);
	return (
		<section id={anchor} className="scroll-mt-8 space-y-3">
			<H2 className="text-2xl">
				{section.version === "Unreleased" ? "Unreleased" : `v${section.version}`}
				{section.date && <span className="ml-3 text-base font-normal text-muted-foreground">{section.date}</span>}
			</H2>
			{subsections.map(([name, bullets]) => (
				<div key={name} className="space-y-1">
					<h3 className="text-sm font-semibold text-muted-foreground">{name}</h3>
					<ul className="list-disc space-y-1 pl-6 text-sm">
						{bullets.map((bullet) => (
							<li key={`${name}-${bullet}`}>{bullet}</li>
						))}
					</ul>
				</div>
			))}
		</section>
	);
}

export default function ChangelogPage() {
	const unreleased = getUnreleased();
	const releases = getReleases();
	const showUnreleased = isNonEmpty(unreleased);

	return (
		<div className="min-h-screen bg-background font-[family-name:var(--font-geist-sans)]">
			<main className="mx-auto max-w-3xl p-6 space-y-8">
				<div className="space-y-3">
					<Link href="/">
						<Button variant="ghost" size="sm" className="-ml-2">
							← Back to viewer
						</Button>
					</Link>
					<H1 className="text-3xl lg:text-4xl">Changelog</H1>
					<p className="text-sm text-muted-foreground">
						User-facing changes to CMDT. Format:{" "}
						<a
							href="https://keepachangelog.com/en/1.1.0/"
							className="underline underline-offset-4"
							target="_blank"
							rel="noopener noreferrer"
						>
							Keep a Changelog 1.1.0
						</a>
						.
					</p>
				</div>

				{showUnreleased && unreleased && <Section section={unreleased} anchor="unreleased" />}

				{releases.map((release) => (
					<Section key={release.version} section={release} anchor={versionAnchorId(release.version)} />
				))}

				{releases.length === 0 && !showUnreleased && (
					<p className="text-sm text-muted-foreground">No release notes yet.</p>
				)}
			</main>
		</div>
	);
}
