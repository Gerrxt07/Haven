const SENSITIVE_KEYS = [
	"authorization",
	"token",
	"access_token",
	"refresh_token",
	"ciphertext",
	"nonce",
	"aad",
	"key",
	"private",
	"secret",
	"signature",
];

function looksSensitive(key: string): boolean {
	const normalized = key.toLowerCase();
	return SENSITIVE_KEYS.some((needle) => normalized.includes(needle));
}

function mask(value: unknown): string {
	if (typeof value !== "string") {
		return "[REDACTED]";
	}
	if (value.length <= 8) {
		return "[REDACTED]";
	}
	return `${value.slice(0, 4)}...[REDACTED]...${value.slice(-2)}`;
}

export function redactSensitive<T>(value: T): T {
	if (!value || typeof value !== "object") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => redactSensitive(entry)) as T;
	}

	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (looksSensitive(key)) {
			out[key] = mask(entry);
			continue;
		}
		if (entry && typeof entry === "object") {
			out[key] = redactSensitive(entry);
			continue;
		}
		out[key] = entry;
	}
	return out as T;
}

export function safeWarn(message: string, metadata?: unknown): void {
	if (metadata === undefined) {
		console.warn(message);
		return;
	}
	console.warn(message, redactSensitive(metadata));
}
