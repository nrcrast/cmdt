export function getCommonEntries(list: Array<Array<string>>): number {
	const minLength = Math.min(...list.map((e) => e.length));
	let lastCommon = -1;
	for (let i = 0; i < minLength; i++) {
		if (list.every((e) => e[i] === list[0]?.[i])) {
			lastCommon = i;
		} else {
			break;
		}
	}
	return lastCommon;
}
