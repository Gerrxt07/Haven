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
};

function resolveBaseUrl(): string {
	return "https://havenapi.becloudly.eu/api/v1";
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

	async post<TBody, TResponse>(
		path: string,
		body: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		return this.request<TResponse>("POST", path, body, options);
	}

	async postFormData<TResponse>(
		path: string,
		formData: FormData,
		options?: RequestOptions,
	): Promise<TResponse> {
		return this.request<TResponse>("POST", path, formData, options);
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
				safeWarn("API retry scheduled", {
					method,
					path,
					attempt,
					idempotent: Boolean(options?.idempotencyKey),
				});
				await new Promise((resolve) => {
					setTimeout(resolve, 250 * attempt);
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
		const timeout = setTimeout(
			() => controller.abort("timeout"),
			this.timeoutMs,
		);

		const signals: AbortSignal[] = [controller.signal];
		if (options?.signal) {
			signals.push(options.signal);
		}
		const signal = AbortSignal.any(signals);

		const headers = new Headers(options?.headers ?? {});
		const isFormData =
			typeof FormData !== "undefined" && body instanceof FormData;

		if (!isFormData && body !== undefined && !headers.has("content-type")) {
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

		try {
			const requestBody =
				body === undefined
					? undefined
					: isFormData
						? (body as FormData)
						: JSON.stringify(body);

			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers,
				body: requestBody,
				signal,
			});

			if (!response.ok) {
				throw new HttpApiError(await mapHttpError(response));
			}

			if (response.status === 204) {
				return undefined as T;
			}

			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof HttpApiError) {
				throw error;
			}
			throw new HttpApiError(mapUnknownError(error));
		} finally {
			clearTimeout(timeout);
		}
	}
}
