"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
	value: string;
	className?: string;
}

/** Legacy copy path for insecure contexts where navigator.clipboard is unavailable. */
function fallbackCopy(value: string) {
	const textarea = document.createElement("textarea");
	textarea.value = value;
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();
	try {
		document.execCommand("copy");
	} finally {
		document.body.removeChild(textarea);
	}
}

export function CopyButton({ value, className }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!value) return;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				fallbackCopy(value);
			}
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard write can fail (e.g. insecure context or denied permission); ignore.
		}
	};

	return (
		<Button variant="ghost" size="sm" className={className} onClick={handleCopy} title="Copy to clipboard">
			{copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
		</Button>
	);
}
