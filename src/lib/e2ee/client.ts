import {
	claimBundle,
	getPublicBundle,
	sendEncryptedMessage,
	uploadKeyBundle,
} from "./api";
import {
	b64Decode,
	b64Encode,
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
import type { RatchetState, SessionEnvelope } from "./types";
import {
	claimedBundleToRecipient,
	generateBundleUploadPayload,
	x3dhInitiatorSharedSecret,
	x3dhResponderSharedSecret,
} from "./x3dh";

export async function bootstrapOwnBundle(userId: number): Promise<void> {
	await initE2eeCrypto();
	const generated = await generateBundleUploadPayload({
		userId,
		oneTimePrekeyCount: 100,
	});

	await uploadKeyBundle(generated.payload);
	await saveIdentity(userId, generated.identity);
	await saveSignedPrekeyPrivate(userId, generated.signedPrekeyPrivate);

	for (const [id, value] of Object.entries(generated.oneTimePrekeyPrivates)) {
		await saveOneTimePrekeyPrivate(userId, Number(id), value);
	}
}

function conversationKey(userA: number, userB: number): string {
	return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

export async function establishSessionAsInitiator(params: {
	selfUserId: number;
	targetUserId: number;
}): Promise<RatchetState> {
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
	return state;
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
