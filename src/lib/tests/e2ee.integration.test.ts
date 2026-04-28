import { afterEach, describe, expect, it } from "bun:test";
import type { IElectronAPI } from "../../types/electron";
import {
	decryptDmMessage,
	encryptDmMessage,
	ensureOwnBundle,
} from "../e2ee/client";
import {
	b64Encode,
	generateEd25519KeyPair,
	generateX25519KeyPair,
	initE2eeCrypto,
	randomBytes,
	signDetached,
} from "../e2ee/crypto";
import {
	initRatchetFromX3dh,
	ratchetDecrypt,
	ratchetEncrypt,
} from "../e2ee/ratchet";
import {
	generateBundleUploadPayload,
	x3dhInitiatorSharedSecret,
	x3dhResponderSharedSecret,
} from "../e2ee/x3dh";

const originalElectronApi = globalThis.electronAPI;
const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.electronAPI = originalElectronApi;
	globalThis.fetch = originalFetch;
});

describe("E2EE integration", () => {
	it("produces matching X3DH shared secrets", async () => {
		await initE2eeCrypto();
		const initiatorIdentity = generateX25519KeyPair();
		const initiatorEphemeral = generateX25519KeyPair();
		const responderIdentity = generateX25519KeyPair();
		const responderIdentitySigning = generateEd25519KeyPair();
		const responderSignedPrekey = generateX25519KeyPair();
		const responderOneTime = generateX25519KeyPair();
		const signature = signDetached(
			responderSignedPrekey.publicKey,
			responderIdentitySigning.privateKey,
		);

		const initiatorSecret = await x3dhInitiatorSharedSecret({
			initiatorIdentityPrivate: b64Encode(initiatorIdentity.privateKey),
			initiatorEphemeralPrivate: b64Encode(initiatorEphemeral.privateKey),
			responderIdentityPublic: b64Encode(responderIdentity.publicKey),
			responderIdentitySigningPublic: b64Encode(
				responderIdentitySigning.publicKey,
			),
			responderSignedPrekeyPublic: b64Encode(responderSignedPrekey.publicKey),
			responderSignedPrekeySignature: b64Encode(signature),
			responderOneTimePrekeyPublic: b64Encode(responderOneTime.publicKey),
		});

		const responderSecret = await x3dhResponderSharedSecret({
			responderIdentityPrivate: b64Encode(responderIdentity.privateKey),
			responderSignedPrekeyPrivate: b64Encode(responderSignedPrekey.privateKey),
			responderOneTimePrekeyPrivate: b64Encode(responderOneTime.privateKey),
			initiatorIdentityPublic: b64Encode(initiatorIdentity.publicKey),
			initiatorEphemeralPublic: b64Encode(initiatorEphemeral.publicKey),
		});

		expect(b64Encode(initiatorSecret)).toBe(b64Encode(responderSecret));
	});

	it("encrypts and decrypts ratchet message end-to-end", async () => {
		await initE2eeCrypto();
		const secret = randomBytes(32);
		const senderDh = generateX25519KeyPair();
		const receiverDh = generateX25519KeyPair();

		const sender = initRatchetFromX3dh({
			sharedSecret: secret,
			selfPrivate: b64Encode(senderDh.privateKey),
			selfPublic: b64Encode(senderDh.publicKey),
			remotePublic: b64Encode(receiverDh.publicKey),
			initiator: true,
		});
		const receiver = initRatchetFromX3dh({
			sharedSecret: secret,
			selfPrivate: b64Encode(receiverDh.privateKey),
			selfPublic: b64Encode(receiverDh.publicKey),
			remotePublic: b64Encode(senderDh.publicKey),
			initiator: false,
		});

		const encrypted = ratchetEncrypt(sender, "hello secure world");
		const decrypted = ratchetDecrypt(receiver, encrypted.envelope);
		expect(decrypted.plaintext).toBe("hello secure world");
	});

	it("rejects X3DH bundles with invalid signed prekey signatures", async () => {
		await initE2eeCrypto();
		const initiatorIdentity = generateX25519KeyPair();
		const initiatorEphemeral = generateX25519KeyPair();
		const responderIdentity = generateX25519KeyPair();
		const responderIdentitySigning = generateEd25519KeyPair();
		const responderSignedPrekey = generateX25519KeyPair();

		await expect(
			x3dhInitiatorSharedSecret({
				initiatorIdentityPrivate: b64Encode(initiatorIdentity.privateKey),
				initiatorEphemeralPrivate: b64Encode(initiatorEphemeral.privateKey),
				responderIdentityPublic: b64Encode(responderIdentity.publicKey),
				responderIdentitySigningPublic: b64Encode(
					responderIdentitySigning.publicKey,
				),
				responderSignedPrekeyPublic: b64Encode(responderSignedPrekey.publicKey),
				responderSignedPrekeySignature: b64Encode(randomBytes(64)),
			}),
		).rejects.toThrow("E2EE trust failure");
	});

	it("uses unpredictable unique prekey identifiers in bundle uploads", async () => {
		await initE2eeCrypto();
		const generated = await generateBundleUploadPayload({
			userId: 7,
			oneTimePrekeyCount: 12,
		});

		const ids = [
			generated.payload.signed_prekey_id,
			...generated.payload.one_time_prekeys.map((prekey) => prekey.id),
		];

		expect(new Set(ids).size).toBe(ids.length);
		expect(generated.payload.identity_signing_key).toBe(
			generated.identity.signingPublicKey,
		);
	});

	it("rejects oversized ratchet skip windows", async () => {
		await initE2eeCrypto();
		const secret = randomBytes(32);
		const senderDh = generateX25519KeyPair();
		const receiverDh = generateX25519KeyPair();
		const receiver = initRatchetFromX3dh({
			sharedSecret: secret,
			selfPrivate: b64Encode(receiverDh.privateKey),
			selfPublic: b64Encode(receiverDh.publicKey),
			remotePublic: b64Encode(senderDh.publicKey),
			initiator: false,
		});

		expect(() =>
			ratchetDecrypt(receiver, {
				header: {
					dhPub: b64Encode(senderDh.publicKey),
					pn: 0,
					n: 5_000,
				},
				nonce: b64Encode(randomBytes(24)),
				ciphertext: b64Encode(randomBytes(48)),
				aad: "",
				algorithm: "xchacha20poly1305",
			}),
		).toThrow("ratchet skip window exceeded safety limit");
	});

	it("encrypts and decrypts first direct message through transport payload", async () => {
		const secureValues: Record<string, string> = {};
		const bundles = new Map<number, Record<string, unknown>>();

		globalThis.electronAPI = {
			e2eeStoreSet: async (key: string, value: string) => {
				secureValues[key] = value;
				return true;
			},
			e2eeStoreGet: async (key: string) => secureValues[key] ?? null,
			e2eeStoreDelete: async (key: string) => {
				delete secureValues[key];
				return true;
			},
		} as IElectronAPI;

		globalThis.fetch = (async (input, init) => {
			const url = String(input);
			const body =
				typeof init?.body === "string"
					? (JSON.parse(init.body) as Record<string, unknown>)
					: {};

			if (url.endsWith("/e2ee/keys/bundle") && init?.method === "POST") {
				bundles.set(Number(body.user_id), body);
				return Response.json({ ok: true });
			}

			if (url.endsWith("/e2ee/keys/claim") && init?.method === "POST") {
				const targetUserId = Number(body.target_user_id);
				const bundle = bundles.get(targetUserId);
				const oneTimePrekeys = bundle?.one_time_prekeys as
					| Array<{ id: number; prekey: string }>
					| undefined;
				const prekey = oneTimePrekeys?.[0];
				return Response.json({
					user_id: targetUserId,
					identity_key: bundle?.identity_key,
					identity_signing_key: bundle?.identity_signing_key,
					signed_prekey_id: bundle?.signed_prekey_id,
					signed_prekey: bundle?.signed_prekey,
					signed_prekey_signature: bundle?.signed_prekey_signature,
					one_time_prekey_id: prekey?.id,
					one_time_prekey: prekey?.prekey,
				});
			}

			const bundleMatch = url.match(/\/e2ee\/keys\/bundle\/(\d+)$/);
			if (bundleMatch && (!init?.method || init.method === "GET")) {
				const userId = Number(bundleMatch[1]);
				const bundle = bundles.get(userId);
				return Response.json({
					user_id: userId,
					identity_key: bundle?.identity_key,
					identity_signing_key: bundle?.identity_signing_key,
					signed_prekey_id: bundle?.signed_prekey_id,
					signed_prekey: bundle?.signed_prekey,
					signed_prekey_signature: bundle?.signed_prekey_signature,
				});
			}

			return new Response("not found", { status: 404 });
		}) as typeof fetch;

		await ensureOwnBundle(1);
		await ensureOwnBundle(2);

		const encrypted = await encryptDmMessage({
			selfUserId: 1,
			peerUserId: 2,
			plaintext: "hello secure dm",
		});
		delete secureValues["ratchet:1:2"];
		delete secureValues["conv-secret:1:2"];

		const decrypted = await decryptDmMessage({
			selfUserId: 2,
			peerUserId: 1,
			ciphertext: encrypted.ciphertext,
			nonce: encrypted.nonce,
			aad: encrypted.aad,
			algorithm: encrypted.algorithm,
		});

		expect(decrypted).toBe("hello secure dm");
	});
});
