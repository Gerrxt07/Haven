import type { ApiError } from "./models";

function statusToKind(status: number): ApiError["kind"] {
	switch (status) {
		case 400:
			return "bad-request";
		case 401:
			return "unauthorized";
		case 403:
			return "forbidden";
		case 404:
			return "not-found";
		case 409:
			return "conflict";
		case 422:
			return "validation";
		default:
			return status >= 500 ? "server" : "unknown";
	}
}

export async function mapHttpError(response: Response): Promise<ApiError> {
	let payload: { error?: string; code?: string; details?: unknown } | null =
		null;

	try {
		payload = (await response.json()) as {
			error?: string;
			code?: string;
			details?: unknown;
		};
	} catch {
		// ignore
	}

	return {
		kind: statusToKind(response.status),
		status: response.status,
		message: payload?.error ?? `Request failed with status ${response.status}`,
		code: payload?.code,
		details: payload?.details,
	};
}

export function mapUnknownError(error: unknown): ApiError {
	if (error instanceof DOMException && error.name === "AbortError") {
		return {
			kind: "aborted",
			message: "request aborted",
		};
	}

	if (error instanceof Error) {
		if (error.message.includes("timeout")) {
			return {
				kind: "timeout",
				message: error.message,
			};
		}

		return {
			kind: "network",
			message: error.message,
		};
	}

	return {
		kind: "unknown",
		message: "unknown request error",
	};
}
