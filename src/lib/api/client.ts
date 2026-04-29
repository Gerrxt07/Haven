import { writeDetailedLog } from "../logging/detailed";
import { safeWarn } from "../security/redaction";
import { mapHttpError, mapUnknownError } from "./errors";
import type { ApiError } from "./models";

export class HttpApiError extends Error {
	readonly apiError: ApiError;

	constructor(apiError: ApiError) {
		super(apiError.message);
		this.name = "HttpApiError";
		this.apiError = apiError;
	}
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<boolean>;
const RETRY_BASE_DELAY_MS = 250;
const RETRY_MAX_DELAY_MS = 5_000;
const RETRY_JITTER_MAX_MS = 250;

export type ApiClientConfig = {
	baseUrl: string;
	timeoutMs?: number;
	maxGetRetries?: number;
	maxIdempotentWriteRetries?: number;
};

export type RequestOptions = {
	signal?: AbortSignal;
	headers?: HeadersInit;
	requiresAuth?: boolean;
	idempotencyKey?: string;
	responseType?: "json" | "text";
	rawJsonBody?: string;
};

function resolveBaseUrl(): string {
	return "https://havenapi.becloudly.eu/api/v1";
}

function isAuthPath(path: string): boolean {
	return path === "/auth" || path.startsWith("/auth/");
}

function toLoggableApiError(error: ApiError): Record<string, unknown> {
	return {
		kind: error.kind,
		status: error.status ?? null,
		code: error.code ?? null,
		message: error.message,
		hasDetails: error.details !== undefined,
	};
}

async function writeAuthApiLog(
	event: string,
	data: Record<string, unknown>,
	level: "debug" | "info" | "warn" | "error" = "info",
): Promise<void> {
	await writeDetailedLog("auth-api", event, data, level);
}

function computeRetryDelayMs(attempt: number): number {
	const exponential = Math.min(
		RETRY_MAX_DELAY_MS,
		RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
	);
	const jitter = Math.floor(Math.random() * RETRY_JITTER_MAX_MS);
	return exponential + jitter;
}

export class ApiClient {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly maxGetRetries: number;
	private readonly maxIdempotentWriteRetries: number;
	private tokenProvider: TokenProvider = () => null;
	private refreshHandler: RefreshHandler | null = null;

	constructor(config?: ApiClientConfig) {
		this.baseUrl = (config?.baseUrl ?? resolveBaseUrl()).replace(/\/$/, "");
		this.timeoutMs = config?.timeoutMs ?? 12_000;
		this.maxGetRetries = config?.maxGetRetries ?? 2;
		this.maxIdempotentWriteRetries = config?.maxIdempotentWriteRetries ?? 1;
	}

	setTokenProvider(provider: TokenProvider): void {
		this.tokenProvider = provider;
	}

	setRefreshHandler(handler: RefreshHandler): void {
		this.refreshHandler = handler;
	}

	async get<T>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>("GET", path, undefined, options);
	}

	async getText(path: string, options?: RequestOptions): Promise<string> {
		return this.request<string>("GET", path, undefined, {
			...options,
			responseType: "text",
		});
	}

	async post<TBody, TResponse>(
		path: string,
		body: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		return this.request<TResponse>("POST", path, body, options);
	}

	async postText<TBody>(
		path: string,
		body: TBody,
		options?: RequestOptions,
	): Promise<string> {
		return this.request<string>("POST", path, body, {
			...options,
			responseType: "text",
		});
	}

	async postRawJsonText(
		path: string,
		rawJsonBody: string,
		options?: RequestOptions,
	): Promise<string> {
		return this.request<string>("POST", path, undefined, {
			...options,
			rawJsonBody,
			responseType: "text",
		});
	}

	async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<T> {
		const retries =
			method === "GET"
				? this.maxGetRetries
				: options?.idempotencyKey
					? this.maxIdempotentWriteRetries
					: 0;
		let attempt = 0;

		while (true) {
			try {
				return await this.executeOnce<T>(method, path, body, options);
			} catch (error) {
				if (error instanceof HttpApiError) {
					if (
						error.apiError.kind === "unauthorized" &&
						options?.requiresAuth &&
						this.refreshHandler
					) {
						const refreshed = await this.refreshHandler();
						if (refreshed) {
							continue;
						}
					}

					if (
						attempt >= retries ||
						(error.apiError.kind !== "network" &&
							error.apiError.kind !== "timeout")
					) {
						throw error;
					}
				} else {
					if (attempt >= retries) {
						throw error;
					}
				}

				attempt += 1;
				const delayMs = computeRetryDelayMs(attempt);
				safeWarn("API retry scheduled", {
					method,
					path,
					attempt,
					idempotent: Boolean(options?.idempotencyKey),
					delayMs,
				});
				await new Promise((resolve) => {
					setTimeout(resolve, delayMs);
				});
			}
		}
	}

	private async executeOnce<T>(
		method: string,
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<T> {
		const controller = new AbortController();
		let didTimeout = false;
		const timeout = setTimeout(() => {
			didTimeout = true;
			controller.abort("timeout");
		}, this.timeoutMs);

		const signals: AbortSignal[] = [controller.signal];
		if (options?.signal) {
			signals.push(options.signal);
		}
		const signal = AbortSignal.any(signals);

		const headers = new Headers(options?.headers ?? {});
		const isFormDataBody =
			typeof FormData !== "undefined" && body instanceof FormData;
		if (!isFormDataBody && body !== undefined && !headers.has("content-type")) {
			headers.set("content-type", "application/json");
		}

		if (options?.requiresAuth) {
			const token = this.tokenProvider();
			if (token) {
				headers.set("authorization", `Bearer ${token}`);
			}
		}

		if (options?.idempotencyKey) {
			headers.set("idempotency-key", options.idempotencyKey);
		}

		const shouldLogAuthRequest = isAuthPath(path);
		if (shouldLogAuthRequest) {
			await writeAuthApiLog("request-start", {
				method,
				path,
				requiresAuth: Boolean(options?.requiresAuth),
			});
		}

		try {
			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers,
				body:
					options?.rawJsonBody !== undefined
						? options.rawJsonBody
						: body === undefined
							? undefined
							: isFormDataBody
								? (body as BodyInit)
								: JSON.stringify(body),
				signal,
			});

			if (!response.ok) {
				throw new HttpApiError(await mapHttpError(response));
			}

			if (shouldLogAuthRequest) {
				await writeAuthApiLog("request-success", {
					method,
					path,
					status: response.status,
				});
			}

			if (response.status === 204) {
				return undefined as T;
			}

			const text = await response.text();
			if (options?.responseType === "text") {
				return text as T;
			}
			return JSON.parse(text) as T;
		} catch (error) {
			const apiError =
				error instanceof HttpApiError
					? error
					: new HttpApiError(
							didTimeout
								? {
										kind: "timeout",
										message: `Request timed out after ${this.timeoutMs}ms`,
									}
								: mapUnknownError(error),
						);

			if (shouldLogAuthRequest) {
				await writeAuthApiLog(
					"request-failed",
					{
						method,
						path,
						error: toLoggableApiError(apiError.apiError),
					},
					apiError.apiError.kind === "network" ||
						apiError.apiError.kind === "timeout"
						? "warn"
						: "error",
				);
			}

			throw apiError;
		} finally {
			clearTimeout(timeout);
		}
	}
}
