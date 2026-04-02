import sodium from "libsodium-wrappers-sumo";

import type { Base64 } from "./types";

const B64 = () => sodium.base64_variants.URLSAFE_NO_PADDING;

let initialized = false;

export async function initE2eeCrypto(): Promise<void> {
	if (initialized) return;
	await sodium.ready;
	initialized = true;
}

function utf8Encode(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

function utf8Decode(value: Uint8Array): string {
	return new TextDecoder().decode(value);
}

export function b64Encode(value: Uint8Array): Base64 {
	return sodium.to_base64(value, B64());
}

export function b64Decode(value: Base64): Uint8Array {
	return sodium.from_base64(value, B64());
}

export function randomBytes(length: number): Uint8Array {
	return sodium.randombytes_buf(length);
}

export function generateX25519KeyPair(): {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
} {
	return sodium.crypto_kx_keypair();
}

export function scalarMult(
	privateKey: Uint8Array,
	publicKey: Uint8Array,
): Uint8Array {
	return sodium.crypto_scalarmult(privateKey, publicKey);
}

export function hash32(input: Uint8Array): Uint8Array {
	return sodium.crypto_generichash(32, input);
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
	return sodium.crypto_auth_hmacsha256(message, key);
}

export function kdfChain(chainKey: Uint8Array): {
	nextChainKey: Uint8Array;
	messageKey: Uint8Array;
} {
	const nextChainKey = hmacSha256(chainKey, utf8Encode("ck"));
	const messageKey = hmacSha256(chainKey, utf8Encode("mk"));
	return { nextChainKey, messageKey };
}

export function kdfRoot(
	rootKey: Uint8Array,
	dhOut: Uint8Array,
): { nextRootKey: Uint8Array; chainKey: Uint8Array } {
	const mixed = new Uint8Array(rootKey.length + dhOut.length);
	mixed.set(rootKey, 0);
	mixed.set(dhOut, rootKey.length);

	const nextRootKey = hmacSha256(rootKey, mixed);
	const chainKey = hmacSha256(nextRootKey, utf8Encode("rk->ck"));
	return { nextRootKey, chainKey };
}

export function xchachaEncrypt(
	plaintext: string,
	key32: Uint8Array,
	aad: Uint8Array,
): { nonce: Base64; ciphertext: Base64 } {
	const nonce = randomBytes(24);
	const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
		utf8Encode(plaintext),
		aad,
		null,
		nonce,
		key32,
	);

	return {
		nonce: b64Encode(nonce),
		ciphertext: b64Encode(ciphertext),
	};
}

export function xchachaDecrypt(
	ciphertext: Base64,
	nonce: Base64,
	key32: Uint8Array,
	aad: Uint8Array,
): string {
	const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
		null,
		b64Decode(ciphertext),
		aad,
		b64Decode(nonce),
		key32,
	);
	return utf8Decode(plain);
}

export function concatBytes(...values: Uint8Array[]): Uint8Array {
	const len = values.reduce((acc, value) => acc + value.length, 0);
	const out = new Uint8Array(len);
	let offset = 0;
	for (const v of values) {
		out.set(v, offset);
		offset += v.length;
	}
	return out;
}
