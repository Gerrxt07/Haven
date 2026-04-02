import { afterEach, describe, expect, it } from "bun:test";

import { apiLogin } from "../api/auth";
import { apiCreateMessage } from "../api/chat";
import { getPublicBundle } from "../e2ee/api";

const originalFetch = globalThis.fetch;

function setMockFetch(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
	globalThis.fetch = Object.assign(handler, {
		preconnect: () => {
			// Bun-specific fetch extension in typings
		},
	}) as typeof globalThis.fetch;
}

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("API contract validation", () => {
	it("accepts valid auth response shape", async () => {
		setMockFetch(async () =>
			jsonResponse({
				access_token: "acc",
				refresh_token: "ref",
				token_type: "Bearer",
				expires_in_seconds: 900,
			}),
		);

		const response = await apiLogin({
			email: "a@b.com",
			password: "supersecret",
		});
		expect(response.access_token).toBe("acc");
	});

	it("rejects invalid auth response shape", async () => {
		setMockFetch(async () =>
			jsonResponse({
				access_token: "acc",
				token_type: "Bearer",
				expires_in_seconds: 900,
			}),
		);

		await expect(
			apiLogin({ email: "a@b.com", password: "supersecret" }),
		).rejects.toThrow();
	});

	it("rejects invalid chat message contract", async () => {
		setMockFetch(async () =>
			jsonResponse({
				channel_id: 1,
				author_user_id: 5,
				content: "hello",
				is_encrypted: false,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			}),
		);

		await expect(
			apiCreateMessage({ channel_id: 1, author_user_id: 5, content: "hello" }),
		).rejects.toThrow();
	});

	it("rejects invalid e2ee bundle contract", async () => {
		setMockFetch(async () => jsonResponse({ user_id: 1, identity_key: "x" }));
		await expect(getPublicBundle(1)).rejects.toThrow();
	});
});
