/**
 * Utility method to do fixed point comparison on floating point numbers
 * @param a
 * @param b
 * @param precision - precision in number of decimals
 * @returns < 0 if a < b, > 0 if a > b, 0 if equal
 */
function fixedPointFloatCompare(a: number, b: number, precision: number): number {
	const multiplier = 10 ** precision;
	return Math.floor(a * multiplier) - Math.floor(b * multiplier);
}

export function fixedPointLessThan(a: number, b: number, precision: number): boolean {
	return fixedPointFloatCompare(a, b, precision) < 0;
}

export function fixedPointGreaterThan(a: number, b: number, precision: number): boolean {
	return fixedPointFloatCompare(a, b, precision) > 0;
}

export function fixedPointLessThanEq(a: number, b: number, precision: number): boolean {
	return fixedPointFloatCompare(a, b, precision) <= 0;
}

export function fixedPointGreaterThanEq(a: number, b: number, precision: number): boolean {
	return fixedPointFloatCompare(a, b, precision) >= 0;
}

export function fixedPointEqual(a: number, b: number, precision: number): boolean {
	return fixedPointFloatCompare(a, b, precision) === 0;
}

export function fixedPointInRange(
	target: number,
	start: number,
	end: number,
	precision: number,
	config?: { inclusiveStart?: boolean; inclusiveEnd?: boolean },
) {
	const startCompareMethod = config?.inclusiveStart ? fixedPointGreaterThanEq : fixedPointGreaterThan;
	const endCompareMethod = config?.inclusiveEnd ? fixedPointLessThanEq : fixedPointLessThan;
	return startCompareMethod(target, start, precision) && endCompareMethod(target, end, precision);
}
