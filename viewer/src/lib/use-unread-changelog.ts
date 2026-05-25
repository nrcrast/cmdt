"use client";
import { useCallback, useEffect, useState } from "react";
import { compareSemver } from "./changelog";

const STORAGE_KEY = "lastSeenChangelogVersion";

/**
 * Tracks whether the current bundled CMDT version is newer than the
 * lastSeenChangelogVersion stored in localStorage. Returns `{ hasUnread,
 * markSeen }`. `hasUnread` is always `false` during SSR and the initial render
 * so the static export and the first client render agree; the real value is
 * filled in after mount.
 */
export function useUnreadChangelog(currentVersion: string | null): {
	hasUnread: boolean;
	markSeen: () => void;
} {
	const [hasUnread, setHasUnread] = useState(false);

	useEffect(() => {
		if (!currentVersion || typeof window === "undefined") return;
		try {
			const lastSeen = window.localStorage.getItem(STORAGE_KEY);
			if (lastSeen === null || compareSemver(currentVersion, lastSeen) > 0) {
				setHasUnread(true);
			}
		} catch {
			// localStorage may throw in private/strict modes; treat as no unread.
		}
	}, [currentVersion]);

	const markSeen = useCallback(() => {
		if (!currentVersion || typeof window === "undefined") return;
		try {
			window.localStorage.setItem(STORAGE_KEY, currentVersion);
		} catch {
			// ignore
		}
		setHasUnread(false);
	}, [currentVersion]);

	return { hasUnread, markSeen };
}
