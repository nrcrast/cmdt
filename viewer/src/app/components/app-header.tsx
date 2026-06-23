"use client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUnreadChangelog } from "@/lib/use-unread-changelog";
import { ChangelogPopoverContent } from "./changelog-popover";

const VERSION = process.env.NEXT_PUBLIC_CMDT_VERSION ?? null;

export function AppHeader() {
	const { hasUnread, markSeen } = useUnreadChangelog(VERSION);

	const handleOpenChange = (open: boolean) => {
		if (open) markSeen();
	};

	return (
		<div className="text-center sm:text-left">
			<h1 className="scroll-m-20 bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
				Common Media Diagnostic Tool (CMDT)
			</h1>
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
