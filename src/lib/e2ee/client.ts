import {
	claimBundle,
	getPublicBundle,
	sendEncryptedMessage,
	uploadKeyBundle,
} from "./api";
import {
	b64Decode,
	b64Encode,
	b64Decode as decodeBase64,
	b64Encode as encodeBase64,
	generateX25519KeyPair,
	initE2eeCrypto,
	xchachaEncrypt,
} from "./crypto";
import {
	deriveRecipientWrapKey,
	initRatchetFromX3dh,
	ratchetDecrypt,
	ratchetEncrypt,
} from "./ratchet";
import {
	deleteOneTimePrekeyPrivate,
	loadConversationSecret,
	loadIdentity,
	loadOneTimePrekeyPrivate,
	loadRatchetState,
	loadSignedPrekeyPrivate,
	saveConversationSecret,
	saveIdentity,
	saveOneTimePrekeyPrivate,
	saveRatchetState,
	saveSignedPrekeyPrivate,
} from "./storage";
import type { E2eeHeader, RatchetState, SessionEnvelope } from "./types";
import {
	claimedBundleToRecipient,
	generateBundleUploadPayload,
	x3dhInitiatorSharedSecret,
	x3dhResponderSharedSecret,
} from "./x3dh";

export async function bootstrapOwnBundle(
	userId: number,
	accessToken?: string | null,
): Promise<void> {
	await initE2eeCrypto();
	const generated = await generateBundleUploadPayload({
		userId,
		oneTimePrekeyCount: 100,
	});

	await uploadKeyBundle(generated.payload, accessToken);
	await saveIdentity(userId, generated.identity);
	await saveSignedPrekeyPrivate(userId, generated.signedPrekeyPrivate);

	for (const [id, value] of Object.entries(generated.oneTimePrekeyPrivates)) {
		await saveOneTimePrekeyPrivate(userId, Number(id), value);
	}
}

function conversationKey(userA: number, userB: number): string {
	return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

type DmX3dhInit = {
	initiatorIdentityPublic: string;
	initiatorEphemeralPublic: string;
	oneTimePrekeyId?: number;
};

type DmTransportEnvelope = {
	v: 1;
	header: E2eeHeader;
	x3dh?: DmX3dhInit;
};

export type EncryptedDmPayload = {
	ciphertext: string;
	nonce: string;
	aad: string;
	algorithm: "xchacha20poly1305+double-ratchet-v1";
};

function encodeJsonBase64(value: unknown): string {
	const json = JSON.stringify(value);
	return encodeBase64(new TextEncoder().encode(json));
}

function decodeJsonBase64<T>(value: string): T {
	const bytes = decodeBase64(value);
	return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function assertDmTransportEnvelope(
	value: unknown,
): asserts value is DmTransportEnvelope {
	if (!value || typeof value !== "object") {
		throw new Error("invalid encrypted DM envelope");
	}
	const candidate = value as Record<string, unknown>;
	if (
		candidate.v !== 1 ||
		!candidate.header ||
		typeof candidate.header !== "object"
	) {
		throw new Error("unsupported encrypted DM envelope");
	}
	const header = candidate.header as Record<string, unknown>;
	if (
		typeof header.dhPub !== "string" ||
		typeof header.pn !== "number" ||
		typeof header.n !== "number"
	) {
		throw new Error("invalid encrypted DM header");
	}
}

export async function ensureOwnBundle(
	userId: number,
	accessToken?: string | null,
): Promise<void> {
	await initE2eeCrypto();
	const existing = await loadIdentity(userId);
	if (existing) {
		return;
	}
	await bootstrapOwnBundle(userId, accessToken);
}

export async function establishSessionAsInitiator(params: {
	selfUserId: number;
	targetUserId: number;
}): Promise<RatchetState> {
	const established = await establishSessionAsInitiatorWithMetadata(params);
	return established.state;
}

async function establishSessionAsInitiatorWithMetadata(params: {
	selfUserId: number;
	targetUserId: number;
}): Promise<{ state: RatchetState; x3dh: DmX3dhInit }> {
	await initE2eeCrypto();

	const identity = await loadIdentity(params.selfUserId);
	if (!identity) {
		throw new Error("missing local identity");
	}

	const claimed = await claimBundle(params.selfUserId, params.targetUserId);
	const recipient = claimedBundleToRecipient(claimed);

	const ephemeral = generateX25519KeyPair();
	const sharedSecret = await x3dhInitiatorSharedSecret({
		initiatorIdentityPrivate: identity.privateKey,
		initiatorEphemeralPrivate: b64Encode(ephemeral.privateKey),
		responderIdentityPublic: recipient.identityPublic,
		responderIdentitySigningPublic: recipient.identitySigningPublic,
		responderSignedPrekeyPublic: recipient.signedPrekeyPublic,
		responderSignedPrekeySignature: recipient.signedPrekeySignature,
		responderOneTimePrekeyPublic: recipient.oneTimePrekeyPublic,
	});

	const state = initRatchetFromX3dh({
		sharedSecret,
		selfPrivate: b64Encode(ephemeral.privateKey),
		selfPublic: b64Encode(ephemeral.publicKey),
		remotePublic: recipient.signedPrekeyPublic,
		initiator: true,
	});

	await saveRatchetState(
		conversationKey(params.selfUserId, params.targetUserId),
		state,
	);
	await saveConversationSecret(
		conversationKey(params.selfUserId, params.targetUserId),
		b64Encode(sharedSecret),
	);
	return {
		state,
		x3dh: {
			initiatorIdentityPublic: identity.publicKey,
			initiatorEphemeralPublic: b64Encode(ephemeral.publicKey),
			oneTimePrekeyId: recipient.oneTimePrekeyId,
		},
	};
}

export async function establishSessionAsResponder(params: {
	selfUserId: number;
	initiatorUserId: number;
	initiatorIdentityPublic: string;
	initiatorEphemeralPublic: string;
	oneTimePrekeyId?: number;
}): Promise<RatchetState> {
	await initE2eeCrypto();

	const identity = await loadIdentity(params.selfUserId);
	if (!identity) {
		throw new Error("missing local identity");
	}

	const signedPrekeyPrivate = await loadSignedPrekeyPrivate(params.selfUserId);
	if (!signedPrekeyPrivate) {
		throw new Error("missing signed prekey private");
	}

	const oneTimePrekeyPrivate = params.oneTimePrekeyId
		? await loadOneTimePrekeyPrivate(params.selfUserId, params.oneTimePrekeyId)
		: null;

	const sharedSecret = await x3dhResponderSharedSecret({
		responderIdentityPrivate: identity.privateKey,
		responderSignedPrekeyPrivate: signedPrekeyPrivate,
		responderOneTimePrekeyPrivate: oneTimePrekeyPrivate ?? undefined,
		initiatorIdentityPublic: params.initiatorIdentityPublic,
		initiatorEphemeralPublic: params.initiatorEphemeralPublic,
	});

	if (params.oneTimePrekeyId) {
		await deleteOneTimePrekeyPrivate(params.selfUserId, params.oneTimePrekeyId);
	}

	const signedBundle = await getPublicBundle(params.selfUserId);
	const state = initRatchetFromX3dh({
		sharedSecret,
		selfPrivate: signedPrekeyPrivate,
		selfPublic: signedBundle.signed_prekey,
		remotePublic: params.initiatorEphemeralPublic,
		initiator: false,
	});

	await saveRatchetState(
		conversationKey(params.selfUserId, params.initiatorUserId),
		state,
	);
	await saveConversationSecret(
		conversationKey(params.selfUserId, params.initiatorUserId),
		b64Encode(sharedSecret),
	);
	return state;
}

export async function encryptAndSendMessage(params: {
	selfUserId: number;
	targetUserId: number;
	channelId: number;
	plaintext: string;
}): Promise<SessionEnvelope> {
	await initE2eeCrypto();

	const key = conversationKey(params.selfUserId, params.targetUserId);
	let state = await loadRatchetState(key);
	if (!state) {
		state = await establishSessionAsInitiator({
			selfUserId: params.selfUserId,
			targetUserId: params.targetUserId,
		});
	}

	const encrypted = ratchetEncrypt(state, params.plaintext);
	await saveRatchetState(key, encrypted.state);
	const conversationSecret = await loadConversationSecret(key);
	if (!conversationSecret) {
		throw new Error("missing conversation secret");
	}

	const messageKeyRaw = b64Decode(
		deriveRecipientWrapKey(b64Decode(conversationSecret)),
	);
	const wrapped = xchachaEncrypt(
		encrypted.messageKey,
		messageKeyRaw,
		new TextEncoder().encode("recipient-wrap"),
	);

	await sendEncryptedMessage({
		channelId: params.channelId,
		authorUserId: params.selfUserId,
		envelope: encrypted.envelope,
		recipientKeyBoxes: [
			{
				recipient_user_id: params.targetUserId,
				encrypted_message_key: wrapped.ciphertext,
			},
		],
	});

	return encrypted.envelope;
}

export async function encryptDmMessage(params: {
	selfUserId: number;
	peerUserId: number;
	plaintext: string;
}): Promise<EncryptedDmPayload> {
	await ensureOwnBundle(params.selfUserId);

	const key = conversationKey(params.selfUserId, params.peerUserId);
	let state = await loadRatchetState(key);
	let x3dh: DmX3dhInit | undefined;
	if (!state) {
		const established = await establishSessionAsInitiatorWithMetadata({
			selfUserId: params.selfUserId,
			targetUserId: params.peerUserId,
		});
		state = established.state;
		x3dh = established.x3dh;
	}

	const encrypted = ratchetEncrypt(state, params.plaintext);
	await saveRatchetState(key, encrypted.state);

	const transport: DmTransportEnvelope = {
		v: 1,
		header: encrypted.envelope.header,
		x3dh,
	};

	return {
		ciphertext: encrypted.envelope.ciphertext,
		nonce: encrypted.envelope.nonce,
		aad: encodeJsonBase64(transport),
		algorithm: "xchacha20poly1305+double-ratchet-v1",
	};
}

export async function decryptIncomingMessage(params: {
	selfUserId: number;
	peerUserId: number;
	envelope: SessionEnvelope;
}): Promise<string> {
	await initE2eeCrypto();

	const key = conversationKey(params.selfUserId, params.peerUserId);
	const state = await loadRatchetState(key);
	if (!state) {
		throw new Error("missing ratchet state");
	}

	const decrypted = ratchetDecrypt(state, params.envelope);
	await saveRatchetState(key, decrypted.state);
	return decrypted.plaintext;
}

export async function decryptDmMessage(params: {
	selfUserId: number;
	peerUserId: number;
	ciphertext: string;
	nonce: string;
	aad: string;
	algorithm?: string | null;
}): Promise<string> {
	await ensureOwnBundle(params.selfUserId);
	if (
		params.algorithm &&
		params.algorithm !== "xchacha20poly1305" &&
		params.algorithm !== "xchacha20poly1305+double-ratchet-v1"
	) {
		throw new Error("unsupported encrypted DM algorithm");
	}

	const transport = decodeJsonBase64<unknown>(params.aad);
	assertDmTransportEnvelope(transport);

	const key = conversationKey(params.selfUserId, params.peerUserId);
	let state = await loadRatchetState(key);
	if (!state) {
		const x3dh = transport.x3dh;
		if (!x3dh) {
			throw new Error("missing encrypted DM session setup");
		}
		state = await establishSessionAsResponder({
			selfUserId: params.selfUserId,
			initiatorUserId: params.peerUserId,
			initiatorIdentityPublic: x3dh.initiatorIdentityPublic,
			initiatorEphemeralPublic: x3dh.initiatorEphemeralPublic,
			oneTimePrekeyId: x3dh.oneTimePrekeyId,
		});
	}

	const envelope: SessionEnvelope = {
		header: transport.header,
		nonce: params.nonce,
		ciphertext: params.ciphertext,
		aad: params.aad,
		algorithm: "xchacha20poly1305",
	};
	const decrypted = ratchetDecrypt(state, envelope);
	await saveRatchetState(key, decrypted.state);
	return decrypted.plaintext;
}
