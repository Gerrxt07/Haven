import {
	b64Decode,
	b64Encode,
	concatBytes,
	generateEd25519KeyPair,
	generateX25519KeyPair,
	hash32,
	initE2eeCrypto,
	randomBytes,
	scalarMult,
	signDetached,
	verifyDetached,
} from "./crypto";
import type {
	ClaimedBundle,
	IdentityKeyPair,
	KeyBundleUploadPayload,
} from "./types";

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
	await initE2eeCrypto();
	const keyPair = generateX25519KeyPair();
	const signingKeyPair = generateEd25519KeyPair();
	return {
		publicKey: b64Encode(keyPair.publicKey),
		privateKey: b64Encode(keyPair.privateKey),
		signingPublicKey: b64Encode(signingKeyPair.publicKey),
		signingPrivateKey: b64Encode(signingKeyPair.privateKey),
	};
}

function randomPrekeyId(existingIds: Set<number>): number {
	const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

	while (true) {
		const bytes = randomBytes(8);
		let value = 0n;
		for (const byte of bytes) {
			value = (value << 8n) | BigInt(byte);
		}

		const candidate = Number(value & maxSafeInteger || 1n);
		if (!existingIds.has(candidate)) {
			existingIds.add(candidate);
			return candidate;
		}
	}
}

export function verifySignedPrekeyBundle(input: {
	identitySigningPublicKey: string;
	signedPrekeyPublic: string;
	signedPrekeySignature: string;
}): void {
	const isValid = verifyDetached(
		b64Decode(input.signedPrekeySignature),
		b64Decode(input.signedPrekeyPublic),
		b64Decode(input.identitySigningPublicKey),
	);

	if (!isValid) {
		throw new Error(
			"E2EE trust failure: invalid Ed25519 signed prekey signature",
		);
	}
}

export async function generateBundleUploadPayload(input: {
	userId: number;
	oneTimePrekeyCount?: number;
}): Promise<{
	payload: KeyBundleUploadPayload;
	identity: IdentityKeyPair;
	signedPrekeyPrivate: string;
	oneTimePrekeyPrivates: Record<number, string>;
}> {
	await initE2eeCrypto();
	const oneTimePrekeyCount = Math.max(
		1,
		Math.min(100, input.oneTimePrekeyCount ?? 50),
	);

	const identity = await generateIdentityKeyPair();
	const signedPrekey = generateX25519KeyPair();
	const generatedIds = new Set<number>();
	const signedPrekeyId = randomPrekeyId(generatedIds);
	const oneTimePrekeyPrivates: Record<number, string> = {};

	const oneTimePrekeys = Array.from({ length: oneTimePrekeyCount }).map(() => {
		const kp = generateX25519KeyPair();
		const id = randomPrekeyId(generatedIds);
		oneTimePrekeyPrivates[id] = b64Encode(kp.privateKey);
		return {
			id,
			prekey: b64Encode(kp.publicKey),
		};
	});

	const signature = b64Encode(
		signDetached(signedPrekey.publicKey, b64Decode(identity.signingPrivateKey)),
	);

	return {
		payload: {
			user_id: input.userId,
			identity_key: identity.publicKey,
			identity_signing_key: identity.signingPublicKey,
			signed_prekey_id: signedPrekeyId,
			signed_prekey: b64Encode(signedPrekey.publicKey),
			signed_prekey_signature: signature,
			one_time_prekeys: oneTimePrekeys,
		},
		identity,
		signedPrekeyPrivate: b64Encode(signedPrekey.privateKey),
		oneTimePrekeyPrivates,
	};
}

export async function x3dhInitiatorSharedSecret(input: {
	initiatorIdentityPrivate: string;
	initiatorEphemeralPrivate: string;
	responderIdentityPublic: string;
	responderIdentitySigningPublic: string;
	responderSignedPrekeyPublic: string;
	responderSignedPrekeySignature: string;
	responderOneTimePrekeyPublic?: string;
}): Promise<Uint8Array> {
	await initE2eeCrypto();
	verifySignedPrekeyBundle({
		identitySigningPublicKey: input.responderIdentitySigningPublic,
		signedPrekeyPublic: input.responderSignedPrekeyPublic,
		signedPrekeySignature: input.responderSignedPrekeySignature,
	});

	const dh1 = scalarMult(
		b64Decode(input.initiatorIdentityPrivate),
		b64Decode(input.responderSignedPrekeyPublic),
	);
	const dh2 = scalarMult(
		b64Decode(input.initiatorEphemeralPrivate),
		b64Decode(input.responderIdentityPublic),
	);
	const dh3 = scalarMult(
		b64Decode(input.initiatorEphemeralPrivate),
		b64Decode(input.responderSignedPrekeyPublic),
	);

	const secretParts = [dh1, dh2, dh3];
	if (input.responderOneTimePrekeyPublic) {
		const dh4 = scalarMult(
			b64Decode(input.initiatorEphemeralPrivate),
			b64Decode(input.responderOneTimePrekeyPublic),
		);
		secretParts.push(dh4);
	}

	return hash32(concatBytes(...secretParts));
}

export async function x3dhResponderSharedSecret(input: {
	responderIdentityPrivate: string;
	responderSignedPrekeyPrivate: string;
	responderOneTimePrekeyPrivate?: string;
	initiatorIdentityPublic: string;
	initiatorEphemeralPublic: string;
}): Promise<Uint8Array> {
	await initE2eeCrypto();

	const dh1 = scalarMult(
		b64Decode(input.responderSignedPrekeyPrivate),
		b64Decode(input.initiatorIdentityPublic),
	);
	const dh2 = scalarMult(
		b64Decode(input.responderIdentityPrivate),
		b64Decode(input.initiatorEphemeralPublic),
	);
	const dh3 = scalarMult(
		b64Decode(input.responderSignedPrekeyPrivate),
		b64Decode(input.initiatorEphemeralPublic),
	);

	const secretParts = [dh1, dh2, dh3];
	if (input.responderOneTimePrekeyPrivate) {
		const dh4 = scalarMult(
			b64Decode(input.responderOneTimePrekeyPrivate),
			b64Decode(input.initiatorEphemeralPublic),
		);
		secretParts.push(dh4);
	}

	return hash32(concatBytes(...secretParts));
}

export function claimedBundleToRecipient(claimed: ClaimedBundle): {
	identityPublic: string;
	identitySigningPublic: string;
	signedPrekeyPublic: string;
	signedPrekeySignature: string;
	oneTimePrekeyPublic: string;
	oneTimePrekeyId: number;
} {
	return {
		identityPublic: claimed.identity_key,
		identitySigningPublic: claimed.identity_signing_key,
		signedPrekeyPublic: claimed.signed_prekey,
		signedPrekeySignature: claimed.signed_prekey_signature,
		oneTimePrekeyPublic: claimed.one_time_prekey,
		oneTimePrekeyId: claimed.one_time_prekey_id,
	};
}
