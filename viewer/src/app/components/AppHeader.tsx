"use client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { H1 } from "@/components/ui/typography";
import { useUnreadChangelog } from "@/lib/use-unread-changelog";
import { ChangelogPopoverContent } from "./ChangelogPopover";

const VERSION = process.env.NEXT_PUBLIC_CMDT_VERSION ?? null;

export function AppHeader() {
	const { hasUnread, markSeen } = useUnreadChangelog(VERSION);

	const handleOpenChange = (open: boolean) => {
		if (open) markSeen();
	};

	return (
		<div className="text-center sm:text-left">
			<H1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
				Common Media Diagnostic Tool (CMDT)
			</H1>
			<div className="mt-2">
				<Popover onOpenChange={handleOpenChange}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="group inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
							aria-label={hasUnread ? `Version ${VERSION}, new release notes available` : `Version ${VERSION}`}
						>
							<span>v{VERSION}</span>
							{hasUnread && <span aria-hidden="true" className="inline-block size-2 rounded-full bg-primary" />}
						</button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-80">
						<ChangelogPopoverContent />
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
