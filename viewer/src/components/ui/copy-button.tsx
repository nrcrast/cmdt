"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
	value: string;
	className?: string;
}

export function CopyButton({ value, className }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!value) return;
		await navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button variant="ghost" size="sm" className={className} onClick={handleCopy} title="Copy to clipboard">
			{copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
		</Button>
	);
}
