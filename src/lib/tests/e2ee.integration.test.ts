import { describe, expect, it } from "bun:test";

import {
	b64Encode,
	generateX25519KeyPair,
	initE2eeCrypto,
	randomBytes,
} from "../e2ee/crypto";
import {
	initRatchetFromX3dh,
	ratchetDecrypt,
	ratchetEncrypt,
} from "../e2ee/ratchet";
import {
	x3dhInitiatorSharedSecret,
	x3dhResponderSharedSecret,
} from "../e2ee/x3dh";

describe("E2EE integration", () => {
	it("produces matching X3DH shared secrets", async () => {
		await initE2eeCrypto();
		const initiatorIdentity = generateX25519KeyPair();
		const initiatorEphemeral = generateX25519KeyPair();
		const responderIdentity = generateX25519KeyPair();
		const responderSignedPrekey = generateX25519KeyPair();
		const responderOneTime = generateX25519KeyPair();

		const initiatorSecret = await x3dhInitiatorSharedSecret({
			initiatorIdentityPrivate: b64Encode(initiatorIdentity.privateKey),
			initiatorEphemeralPrivate: b64Encode(initiatorEphemeral.privateKey),
			responderIdentityPublic: b64Encode(responderIdentity.publicKey),
			responderSignedPrekeyPublic: b64Encode(responderSignedPrekey.publicKey),
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
});
