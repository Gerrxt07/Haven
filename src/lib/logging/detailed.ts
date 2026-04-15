import { nativeApp } from "../native";

type DetailedLogLevel = "debug" | "info" | "warn" | "error";

type DetailedLogData = Record<string, unknown>;

function serializeError(error: unknown): DetailedLogData {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack ?? null,
		};
	}

	return {
		value:
			typeof error === "string"
				? error
				: (JSON.stringify(error, null, 2) ?? null),
	};
}

export async function writeDetailedLog(
	scope: string,
	event: string,
	data?: DetailedLogData,
	level: DetailedLogLevel = "info",
): Promise<void> {
	try {
		await nativeApp.writeDetailedLog({
			scope,
			event,
			level,
			data,
		});
	} catch (error) {
		console.warn("Failed to write detailed log", error);
	}
}

export async function writeDetailedErrorLog(
	scope: string,
	event: string,
	error: unknown,
	data?: DetailedLogData,
): Promise<void> {
	await writeDetailedLog(
		scope,
		event,
		{
			...(data ?? {}),
			error: serializeError(error),
		},
		"error",
	);
}
