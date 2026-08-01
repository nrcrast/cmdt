"use client";

import { DEFAULT_LOG_LEVEL, getLogLevel, LogLevel, setLogLevel } from "cmdt-shared";
import { ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = "cmdt.logLevel";

// Presented from least to most verbose. Values map to the shared LogLevel enum.
const LOG_LEVEL_OPTIONS: Array<{ label: string; value: LogLevel }> = [
	{ label: "Off", value: LogLevel.Silent },
	{ label: "Error", value: LogLevel.Error },
	{ label: "Warn", value: LogLevel.Warn },
	{ label: "Info", value: LogLevel.Info },
	{ label: "Debug", value: LogLevel.Debug },
	{ label: "Trace", value: LogLevel.Trace },
];

function parseStoredLevel(raw: string | null): LogLevel | null {
	if (raw === null) {
		return null;
	}
	const parsed = Number.parseInt(raw, 10);
	return LOG_LEVEL_OPTIONS.some((option) => option.value === parsed) ? (parsed as LogLevel) : null;
}

/**
 * Header control for the shared engine's log verbosity. The shared logger is
 * module-global state (not React state), so this reflects and drives it via
 * getLogLevel/setLogLevel and persists the choice across reloads.
 */
export function LogLevelToggle() {
	const [level, setLevelState] = useState<LogLevel>(DEFAULT_LOG_LEVEL);

	// Apply any persisted preference on mount; fall back to the engine's current level.
	useEffect(() => {
		const stored = parseStoredLevel(window.localStorage.getItem(STORAGE_KEY));
		if (stored !== null) {
			setLogLevel(stored);
			setLevelState(stored);
		} else {
			setLevelState(getLogLevel());
		}
	}, []);

	function handleChange(value: string) {
		const next = Number.parseInt(value, 10) as LogLevel;
		setLogLevel(next);
		setLevelState(next);
		window.localStorage.setItem(STORAGE_KEY, String(next));
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" aria-label="Set log level">
					<ScrollText className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Log level</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={String(level)} onValueChange={handleChange}>
					{LOG_LEVEL_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={String(option.value)}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
