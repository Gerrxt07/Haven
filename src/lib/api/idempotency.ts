export function createIdempotencyKey(prefix: string): string {
	const entropy =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	return `${prefix}:${entropy}`;
}
