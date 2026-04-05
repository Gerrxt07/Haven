import { afterEach, describe, expect, it } from "bun:test";

import { authSession } from "../auth/session";
import { decryptIncomingMessage } from "../e2ee/client";
import { x3dhInitiatorSharedSecret } from "../e2ee/x3dh";

const originalFetch = globalThis.fetch;
const originalElectronApi = globalThis.electronAPI;

function setMockFetch(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
	globalThis.fetch = Object.assign(handler, {
		preconnect: () => {
			// Bun-specific fetch extension in typings
		},
	}) as typeof globalThis.fetch;
}

function createMockElectronApi(
	values: Record<string, string | null>,
): typeof globalThis.electronAPI {
	return {
		platform: "linux",
		minimize: () => {},
		maximize: () => {},
		close: () => {},
		getUpdateCandidate: async () => null,
		setUpdateCandidate: async () => true,
		validateEmailDomain: async () => true,
		getWindowState: async () => ({ isMaximized: false, isFullScreen: false }),
		writeDetailedLog: async () => true,
		onWindowStateChanged: () => () => {},
		onExternalLinkWarning: () => () => {},
		confirmOpenUrl: () => {},
		storeToken: async () => true,
		loadToken: async () => values.legacyToken ?? null,
		deleteToken: async () => true,
		secureStoreSet: async (_namespace, key, value) => {
			values[key] = value;
			return true;
		},
		secureStoreGet: async (_namespace, key) => values[key] ?? null,
		secureStoreDelete: async (_namespace, key) => {
			delete values[key];
			return true;
		},
	};
}

afterEach(async () => {
	globalThis.fetch = originalFetch;
	globalThis.electronAPI = originalElectronApi;
	await authSession.logout();
});

describe("Failure handling", () => {
	it("recovers by invalidating session when refresh token is expired", async () => {
		globalThis.electronAPI = createMockElectronApi({
			"token.refresh": "expired-refresh-token",
			"token.access": null,
			legacyToken: null,
		});

		setMockFetch(
			async () =>
				new Response(JSON.stringify({ error: "expired" }), {
					status: 401,
					headers: { "content-type": "application/json" },
				}),
		);

		await authSession.bootstrapFromStorage();
		expect(authSession.accessToken).toBeNull();
		expect(authSession.refreshToken).toBeNull();
	});

	it("fails on invalid prekey material", async () => {
		await expect(
			x3dhInitiatorSharedSecret({
				initiatorIdentityPrivate: "not-base64",
				initiatorEphemeralPrivate: "not-base64",
				responderIdentityPublic: "not-base64",
				responderSignedPrekeyPublic: "not-base64",
			}),
		).rejects.toThrow();
	});

	it("fails decrypt when ratchet state is missing", async () => {
		globalThis.electronAPI = createMockElectronApi({});
		await expect(
			decryptIncomingMessage({
				selfUserId: 1,
				peerUserId: 2,
				envelope: {
					header: { dhPub: "x", pn: 0, n: 0 },
					nonce: "x",
					ciphertext: "x",
					aad: "x",
					algorithm: "xchacha20poly1305",
				},
			}),
		).rejects.toThrow("missing ratchet state");
	});
});
