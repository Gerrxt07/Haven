import {
	b64Decode,
	b64Encode,
	concatBytes,
	generateX25519KeyPair,
	hash32,
	hmacSha256,
	kdfChain,
	kdfRoot,
	scalarMult,
	xchachaDecrypt,
	xchachaEncrypt,
} from "./crypto";
import type {
	Base64,
	E2eeHeader,
	RatchetState,
	SessionEnvelope,
} from "./types";

const MAX_SKIP_MESSAGES = 1_000;
const MAX_STORED_SKIPPED_MESSAGE_KEYS = 2_000;

function toU32(value: number): Uint8Array {
	const out = new Uint8Array(4);
	new DataView(out.buffer).setUint32(0, value, false);
	return out;
}

function skippedKeyMapKey(dhPub: string, n: number): string {
	return `${dhPub}:${n}`;
}

function aadForEnvelope(header: E2eeHeader): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(header));
}

function pruneSkippedMessageKeys(
	skippedMessageKeys: Record<string, Base64>,
): void {
	while (
		Object.keys(skippedMessageKeys).length > MAX_STORED_SKIPPED_MESSAGE_KEYS
	) {
		const oldestKey = Object.keys(skippedMessageKeys)[0];
		if (!oldestKey) {
			return;
		}
		delete skippedMessageKeys[oldestKey];
	}
}

function ensureChainKey(
	chainKey: Base64 | null,
	direction: "send" | "recv",
): Uint8Array {
	if (!chainKey) {
		throw new Error(`missing ${direction} chain key`);
	}
	return b64Decode(chainKey);
}

export function initRatchetFromX3dh(params: {
	sharedSecret: Uint8Array;
	selfPrivate: Base64;
	selfPublic: Base64;
	remotePublic: Base64;
	initiator: boolean;
}): RatchetState {
	const seed = hash32(
		concatBytes(params.sharedSecret, new TextEncoder().encode("haven-dr-v1")),
	);
	const rootKey = hmacSha256(seed, new TextEncoder().encode("root"));
	const chainKey = hmacSha256(rootKey, new TextEncoder().encode("chain"));

	return {
		rootKey: b64Encode(rootKey),
		sendingChainKey: params.initiator ? b64Encode(chainKey) : null,
		receivingChainKey: params.initiator ? null : b64Encode(chainKey),
		dhSelfPrivate: params.selfPrivate,
		dhSelfPublic: params.selfPublic,
		dhRemotePublic: params.remotePublic,
		sendCount: 0,
		recvCount: 0,
		prevChainLength: 0,
		skippedMessageKeys: {},
	};
}

function performDhRatchet(
	state: RatchetState,
	newRemoteDhPub: Base64,
): RatchetState {
	const rootKey = b64Decode(state.rootKey);
	const dhOutRecv = scalarMult(
		b64Decode(state.dhSelfPrivate),
		b64Decode(newRemoteDhPub),
	);
	const recvStep = kdfRoot(rootKey, dhOutRecv);

	const newDh = generateX25519KeyPair();
	const dhOutSend = scalarMult(newDh.privateKey, b64Decode(newRemoteDhPub));
	const sendStep = kdfRoot(recvStep.nextRootKey, dhOutSend);

	return {
		...state,
		rootKey: b64Encode(sendStep.nextRootKey),
		receivingChainKey: b64Encode(recvStep.chainKey),
		sendingChainKey: b64Encode(sendStep.chainKey),
		dhSelfPrivate: b64Encode(newDh.privateKey),
		dhSelfPublic: b64Encode(newDh.publicKey),
		dhRemotePublic: newRemoteDhPub,
		prevChainLength: state.sendCount,
		sendCount: 0,
		recvCount: 0,
	};
}

function skipMessageKeys(state: RatchetState, until: number): RatchetState {
	if (until - state.recvCount > MAX_SKIP_MESSAGES) {
		throw new Error("ratchet skip window exceeded safety limit");
	}

	const current = {
		...state,
		skippedMessageKeys: { ...state.skippedMessageKeys },
	};

	while (current.recvCount < until) {
		const recvChain = ensureChainKey(current.receivingChainKey, "recv");
		const { nextChainKey, messageKey } = kdfChain(recvChain);
		current.receivingChainKey = b64Encode(nextChainKey);
		const key = skippedKeyMapKey(current.dhRemotePublic, current.recvCount);
		current.skippedMessageKeys[key] = b64Encode(messageKey);
		pruneSkippedMessageKeys(current.skippedMessageKeys);
		current.recvCount += 1;
	}

	return current;
}

export function ratchetEncrypt(
	state: RatchetState,
	plaintext: string,
): { state: RatchetState; envelope: SessionEnvelope; messageKey: Base64 } {
	const chainKey = ensureChainKey(state.sendingChainKey, "send");
	const { nextChainKey, messageKey } = kdfChain(chainKey);

	const header: E2eeHeader = {
		dhPub: state.dhSelfPublic,
		pn: state.prevChainLength,
		n: state.sendCount,
	};
	const aad = aadForEnvelope(header);
	const encrypted = xchachaEncrypt(plaintext, messageKey, aad);

	return {
		state: {
			...state,
			sendingChainKey: b64Encode(nextChainKey),
			sendCount: state.sendCount + 1,
		},
		envelope: {
			header,
			nonce: encrypted.nonce,
			ciphertext: encrypted.ciphertext,
			aad: b64Encode(aad),
			algorithm: "xchacha20poly1305",
		},
		messageKey: b64Encode(messageKey),
	};
}

export function ratchetDecrypt(
	state: RatchetState,
	envelope: SessionEnvelope,
): { state: RatchetState; plaintext: string } {
	const aad = aadForEnvelope(envelope.header);
	const skippedKey = skippedKeyMapKey(envelope.header.dhPub, envelope.header.n);
	const found = state.skippedMessageKeys[skippedKey];
	if (found) {
		const plaintext = xchachaDecrypt(
			envelope.ciphertext,
			envelope.nonce,
			b64Decode(found),
			aad,
		);
		const nextState = {
			...state,
			skippedMessageKeys: { ...state.skippedMessageKeys },
		};
		delete nextState.skippedMessageKeys[skippedKey];
		return { state: nextState, plaintext };
	}

	let current = {
		...state,
		skippedMessageKeys: { ...state.skippedMessageKeys },
	};
	if (envelope.header.dhPub !== current.dhRemotePublic) {
		current = performDhRatchet(current, envelope.header.dhPub);
	}

	if (envelope.header.n > current.recvCount) {
		current = skipMessageKeys(current, envelope.header.n);
	}

	const receivingChainKey = ensureChainKey(current.receivingChainKey, "recv");
	const { nextChainKey, messageKey } = kdfChain(receivingChainKey);
	const plaintext = xchachaDecrypt(
		envelope.ciphertext,
		envelope.nonce,
		messageKey,
		aad,
	);

	return {
		state: {
			...current,
			receivingChainKey: b64Encode(nextChainKey),
			recvCount: current.recvCount + 1,
		},
		plaintext,
	};
}

export function serializeRatchetState(state: RatchetState): string {
	return JSON.stringify(state);
}

export function deserializeRatchetState(raw: string): RatchetState {
	const value = JSON.parse(raw) as RatchetState;
	if (
		!value.rootKey ||
		!value.dhSelfPrivate ||
		!value.dhSelfPublic ||
		!value.dhRemotePublic
	) {
		throw new Error("invalid ratchet state");
	}
	return value;
}

export function deriveRecipientWrapKey(sharedSecret: Uint8Array): string {
	const wrap = hash32(
		concatBytes(sharedSecret, new TextEncoder().encode("msg-wrap-v1")),
	);
	return b64Encode(wrap);
}

export function encodeHeaderAsAad(header: E2eeHeader): string {
	return b64Encode(aadForEnvelope(header));
}

export function makeHeaderFingerprint(header: E2eeHeader): string {
	const fp = hash32(
		concatBytes(
			new TextEncoder().encode(header.dhPub),
			toU32(header.n),
			toU32(header.pn),
		),
	);
	return b64Encode(fp);
}
