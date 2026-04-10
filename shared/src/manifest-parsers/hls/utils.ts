export function parseAttributes(allAttributes: string): Map<string, string | undefined> {
	const splitAttributes: Array<string> = [];

	let currentAttributeStart = 0;
	let ignoreSeparator = false;
	for (let i = 0; i < allAttributes.length; i += 1) {
		const c = allAttributes.charAt(i);
		if (c === '"' && !ignoreSeparator) {
			ignoreSeparator = true;
		} else if (c === '"' && ignoreSeparator) {
			ignoreSeparator = false;
		}

		if (c === "," && !ignoreSeparator) {
			splitAttributes.push(allAttributes.substring(currentAttributeStart, i));
			currentAttributeStart = i + 1;
			continue;
		}

		if (i === allAttributes.length - 1) {
			splitAttributes.push(allAttributes.substring(currentAttributeStart, i + 1));
		}
	}

	return splitAttributes.reduce((acc: Map<string, string | undefined>, attribute: string) => {
		const [key, value] = attribute.split("=");

		if (key) {
			if (acc.has(key)) {
				throw new Error(`Duplicate attribute key: ${key}`);
			}
			if (value?.startsWith('"') && value?.endsWith('"')) {
				acc.set(key, value.substring(1, value.length - 1));
			} else {
				acc.set(key, value);
			}
		}
		return acc;
	}, new Map<string, string | undefined>());
}

export function parseBooleanAttribute(line: string): boolean {
	return line === "YES";
}

export function unwrap(value: string): string {
	if (value.startsWith('"') && value.endsWith('"')) {
		return value.substring(1, value.length - 1);
	}
	return value;
}
