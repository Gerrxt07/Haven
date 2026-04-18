import { afterEach, describe, expect, it } from "bun:test";

import { apiLogin, apiLoginChallenge, apiLoginVerify } from "../api/auth";
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

	it("accepts valid SRP challenge response shape", async () => {
		setMockFetch(async () =>
			jsonResponse({
				challenge_id: "challenge-1",
				srp_salt: "salt",
				server_public_key_b: "server-key",
			}),
		);

		const response = await apiLoginChallenge({
			email: "a@b.com",
		});
		expect(response.challenge_id).toBe("challenge-1");
	});

	it("rejects invalid SRP challenge response shape", async () => {
		setMockFetch(async () =>
			jsonResponse({
				challenge_id: "challenge-1",
				srp_salt: "salt",
			}),
		);

		await expect(apiLoginChallenge({ email: "a@b.com" })).rejects.toThrow();
	});

	it("sends SRP verify 2FA fields when provided", async () => {
		let capturedBody: string | null = null;
		setMockFetch(async (_input, init) => {
			capturedBody = typeof init?.body === "string" ? init.body : null;
			return jsonResponse({
				server_proof_m2: "proof",
				access_token: "acc",
				refresh_token: "ref",
				token_type: "Bearer",
				expires_in_seconds: 900,
			});
		});

		await apiLoginVerify(
			{
				email: "a@b.com",
				client_public_key_a: "client-a",
				client_proof_m1: "proof-m1",
				totp_code: "123456",
				backup_code: "backup-1",
			},
			"challenge-1",
		);

		expect(capturedBody).not.toBeNull();
		const requestBody = JSON.parse(capturedBody ?? "");
		expect(requestBody).toEqual({
			email: "a@b.com",
			client_public_key_a: "client-a",
			client_proof_m1: "proof-m1",
			totp_code: "123456",
			backup_code: "backup-1",
		});
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
