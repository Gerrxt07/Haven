import { describe, expect, it } from "bun:test";

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
});
