export function camelToKebab(input: string) {
	return input
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

export function normaliseTag(raw: string): string {
	return raw.trim().replace(/\s+/g, " ").normalize("NFC");
}