// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Secure logging utility with automatic PII/sensitive data filtering

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import log from "electron-log/main";

// Patterns to detect and redact sensitive data
const SENSITIVE_PATTERNS = [
	// Tokens and authentication
	{ pattern: /"token"[:\s]*"[^"]{8,}"/gi, replacement: '"token":"[REDACTED]"' },
	{ pattern: /'token'[:\s]*'[^']{8,}'/gi, replacement: "'token':'[REDACTED]'" },
	{
		pattern: /token[:\s]*[a-zA-Z0-9_-]{20,}/gi,
		replacement: "token: [REDACTED]",
	},

	// Bearer tokens
	{
		pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/gi,
		replacement: "Bearer [REDACTED]",
	},
	{
		pattern: /Authorization[:\s]*Bearer\s+[^\s]+/gi,
		replacement: "Authorization: Bearer [REDACTED]",
	},

	// API keys
	{
		pattern: /api[_-]?key[:\s]*[a-zA-Z0-9_-]{16,}/gi,
		replacement: "api_key: [REDACTED]",
	},
	{
		pattern: /apikey[:\s]*[a-zA-Z0-9_-]{16,}/gi,
		replacement: "apikey: [REDACTED]",
	},

	// Passwords
	{ pattern: /password[:\s]*"[^"]+"/gi, replacement: 'password: "[REDACTED]"' },
	{ pattern: /passwd[:\s]*"[^"]+"/gi, replacement: 'passwd: "[REDACTED]"' },
	{ pattern: /pwd[:\s]*"[^"]+"/gi, replacement: 'pwd: "[REDACTED]"' },

	// Secrets
	{
		pattern: /secret[:\s]*[a-zA-Z0-9_-]{16,}/gi,
		replacement: "secret: [REDACTED]",
	},
	{
		pattern: /client[_-]?secret[:\s]*[a-zA-Z0-9_-]{16,}/gi,
		replacement: "client_secret: [REDACTED]",
	},

	// Session IDs
	{
		pattern: /session[_-]?id[:\s]*[a-zA-Z0-9_-]{16,}/gi,
		replacement: "session_id: [REDACTED]",
	},
	{ pattern: /sid[:\s]*[a-zA-Z0-9_-]{16,}/gi, replacement: "sid: [REDACTED]" },

	// Private keys
	{
		pattern:
			/-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
		replacement: "[PRIVATE_KEY_REDACTED]",
	},

	// Credit cards (basic pattern)
	{
		pattern:
			/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
		replacement: "[CREDIT_CARD_REDACTED]",
	},

	// Email addresses (optional - can be noisy, so we log domain only)
	{
		pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
		replacement: "[EMAIL_REDACTED]@$2",
	},
];

// Fields to exclude from logged objects
const SENSITIVE_FIELDS = new Set([
	"token",
	"accessToken",
	"refreshToken",
	"idToken",
	"password",
	"passwd",
	"pwd",
	"secret",
	"clientSecret",
	"apiKey",
	"api_key",
	"sessionId",
	"session_id",
	"auth",
	"authorization",
	"bearer",
	"privateKey",
	"private_key",
	"creditCard",
	"credit_card",
	"cvv",
	"ssn",
	"dob",
	"dateOfBirth",
]);

// Session ID for correlating logs
const sessionId = randomUUID().slice(0, 8);

/**
 * Sanitize a string by applying all sensitive patterns
 */
function sanitizeString(value: string): string {
	let sanitized = value;
	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, replacement);
	}
	return sanitized;
}

/**
 * Deep sanitize an object, removing sensitive fields and values
 */
function sanitizeObject(obj: unknown, depth = 0, maxDepth = 5): unknown {
	// Prevent excessive recursion
	if (depth > maxDepth) {
		return "[MAX_DEPTH_REACHED]";
	}

	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === "string") {
		return sanitizeString(obj);
	}

	if (typeof obj === "number" || typeof obj === "boolean") {
		return obj;
	}

	if (obj instanceof Error) {
		return {
			name: obj.name,
			message: sanitizeString(obj.message),
			stack: sanitizeString(obj.stack ?? ""),
		};
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeObject(item, depth + 1, maxDepth));
	}

	if (typeof obj === "object") {
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			// Skip sensitive fields entirely
			if (
				SENSITIVE_FIELDS.has(key) ||
				SENSITIVE_FIELDS.has(key.toLowerCase())
			) {
				sanitized[key] = "[REDACTED]";
				continue;
			}

			// Sanitize the value
			sanitized[key] = sanitizeObject(value, depth + 1, maxDepth);
		}
		return sanitized;
	}

	return "[UNSUPPORTED_TYPE]";
}

/**
 * Log levels
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Secure logger interface
 */
interface SecureLogEntry {
	timestamp: string;
	level: LogLevel;
	scope: string;
	event: string;
	data?: Record<string, unknown>;
	sessionId: string;
	pid: number;
}

/**
 * Initialize the secure logger
 */
export function initializeSecureLogger(): void {
	log.initialize();

	// Set log file location to app data logs folder
	const logPath = app.getPath("logs");
	log.transports.file.resolvePathFn = () => path.join(logPath, "haven.log");

	// Configure console transport (only in dev)
	log.transports.console.level = process.env.VITE_DEV_SERVER_URL
		? "debug"
		: false;

	// File transport always enabled
	log.transports.file.level = "info";

	// Format logs as JSON for structured logging
	log.transports.file.format = "{y}/{m}/{d} {h}:{i}:{s}.{ms} [{level}] {text}";

	log.info("Secure logger initialized", {
		sessionId,
		logPath,
		appVersion: app.getVersion(),
		appName: app.getName(),
	});
}

/**
 * Write a secure log entry
 */
export function secureLog(
	scope: string,
	event: string,
	data?: Record<string, unknown>,
	level: LogLevel = "info",
): void {
	try {
		const sanitizedData = data
			? (sanitizeObject(data) as Record<string, unknown>)
			: undefined;

		const entry: SecureLogEntry = {
			timestamp: new Date().toISOString(),
			level,
			scope,
			event,
			data: sanitizedData,
			sessionId,
			pid: process.pid,
		};

		// Log via electron-log
		const message = `[${scope}] ${event}`;
		const meta = sanitizedData
			? { ...sanitizedData, sessionId, pid: process.pid }
			: { sessionId, pid: process.pid };

		switch (level) {
			case "debug":
				log.debug(message, meta);
				break;
			case "info":
				log.info(message, meta);
				break;
			case "warn":
				log.warn(message, meta);
				break;
			case "error":
				log.error(message, meta);
				break;
		}

		// Also append to detailed log for persistence
		void appendToDetailedLog(entry);
	} catch (error) {
		// Fallback to console if logging fails
		console.error("Failed to write secure log:", error);
	}
}

/**
 * Detailed log file path
 */
function getDetailedLogPath(): string {
	return path.join(app.getPath("logs"), "detailed.log");
}

/**
 * Append to the detailed JSON log file
 */
async function appendToDetailedLog(entry: SecureLogEntry): Promise<void> {
	try {
		const logPath = getDetailedLogPath();
		await fs.mkdir(path.dirname(logPath), { recursive: true });
		await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
	} catch {
		// Silent fail - electron-log already captured it
	}
}

/**
 * Convenience methods for different log levels
 */
export const secureLogger = {
	debug: (scope: string, event: string, data?: Record<string, unknown>) =>
		secureLog(scope, event, data, "debug"),
	info: (scope: string, event: string, data?: Record<string, unknown>) =>
		secureLog(scope, event, data, "info"),
	warn: (scope: string, event: string, data?: Record<string, unknown>) =>
		secureLog(scope, event, data, "warn"),
	error: (scope: string, event: string, data?: Record<string, unknown>) =>
		secureLog(scope, event, data, "error"),

	/**
	 * Log an error with full details
	 */
	logError: (
		scope: string,
		event: string,
		error: unknown,
		extraData?: Record<string, unknown>,
	) => {
		const sanitizedError = sanitizeObject(error);
		secureLog(
			scope,
			event,
			{
				...extraData,
				error: sanitizedError,
			},
			"error",
		);
	},

	/**
	 * Log IPC calls (sanitizes arguments)
	 */
	logIpc: (
		direction: "in" | "out",
		channel: string,
		sender: string,
		data?: unknown,
	) => {
		const sanitizedData = sanitizeObject(data);
		secureLog(
			"ipc",
			`${direction === "in" ? "→" : "←"} ${channel}`,
			{
				channel,
				direction,
				sender,
				data: sanitizedData,
			},
			"debug",
		);
	},

	/**
	 * Log window state changes
	 */
	logWindowState: (event: string, data?: Record<string, unknown>) => {
		secureLog("window", event, data, "debug");
	},

	/**
	 * Log lifecycle events
	 */
	logLifecycle: (event: string, data?: Record<string, unknown>) => {
		secureLog("lifecycle", event, data, "info");
	},

	/**
	 * Log security events
	 */
	logSecurity: (
		event: string,
		data?: Record<string, unknown>,
		level: LogLevel = "warn",
	) => {
		secureLog("security", event, data, level);
	},

	/**
	 * Log navigation events
	 */
	logNavigation: (url: string, reason: string) => {
		secureLog("navigation", reason, { url: sanitizeString(url) }, "debug");
	},

	/**
	 * Log download events
	 */
	logDownload: (
		filename: string,
		state: "started" | "completed" | "blocked",
		extra?: Record<string, unknown>,
	) => {
		secureLog(
			"download",
			state,
			{ filename, ...extra },
			state === "blocked" ? "warn" : "info",
		);
	},

	/**
	 * Get the current session ID for correlation
	 */
	getSessionId: () => sessionId,

	/**
	 * Get log file paths
	 */
	getLogPaths: () => ({
		main: path.join(app.getPath("logs"), "haven.log"),
		detailed: getDetailedLogPath(),
	}),
};

export default secureLogger;
