import type { Base64 } from "./types";

type SodiumModule = {
	ready: Promise<void>;
	randombytes_buf: (length: number) => Uint8Array;
	crypto_kx_keypair: () => { publicKey: Uint8Array; privateKey: Uint8Array };
	crypto_scalarmult: (
		privateKey: Uint8Array,
		publicKey: Uint8Array,
	) => Uint8Array;
	crypto_generichash: (length: number, input: Uint8Array) => Uint8Array;
	crypto_auth_hmacsha256: (message: Uint8Array, key: Uint8Array) => Uint8Array;
	crypto_aead_xchacha20poly1305_ietf_encrypt: (
		message: Uint8Array,
		aad: Uint8Array,
		nsec: null,
		nonce: Uint8Array,
		key: Uint8Array,
	) => Uint8Array;
	crypto_aead_xchacha20poly1305_ietf_decrypt: (
		nsec: null,
		ciphertext: Uint8Array,
		aad: Uint8Array,
		nonce: Uint8Array,
		key: Uint8Array,
	) => Uint8Array;
	to_base64: (input: Uint8Array, variant?: number) => string;
	from_base64: (input: string, variant?: number) => Uint8Array;
	base64_variants: { ORIGINAL: number; URLSAFE_NO_PADDING: number };
};

let sodium: SodiumModule | null = null;

const B64 = () => getSodium().base64_variants.URLSAFE_NO_PADDING;

let initialized = false;

function isSodiumModule(value: unknown): value is SodiumModule {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<SodiumModule>;
	return (
		typeof candidate.ready === "object" &&
		candidate.ready !== null &&
		typeof (candidate.ready as Promise<void>).then === "function" &&
		typeof candidate.to_base64 === "function" &&
		typeof candidate.from_base64 === "function"
	);
}

function getSodium(): SodiumModule {
	if (!sodium) {
		throw new Error("E2EE crypto not initialized");
	}
	return sodium;
}

async function loadSodium(): Promise<SodiumModule> {
	const importMetaWithRequire = import.meta as ImportMeta & {
		require?: (id: string) => unknown;
	};
	const bunRequire = importMetaWithRequire.require;
	if (typeof bunRequire === "function") {
		const required = bunRequire("libsodium-wrappers-sumo");
		const fromBunRequire =
			typeof required === "object" && required !== null && "default" in required
				? (required as { default: unknown }).default
				: required;
		if (isSodiumModule(fromBunRequire)) {
			return fromBunRequire;
		}
	}

	const maybeRequire = Reflect.get(
		globalThis as Record<string, unknown>,
		"require",
	);

	if (typeof maybeRequire === "function") {
		const required = (maybeRequire as (id: string) => unknown)(
			"libsodium-wrappers-sumo",
		);
		const fromRequire =
			typeof required === "object" && required !== null && "default" in required
				? (required as { default: unknown }).default
				: required;
		if (isSodiumModule(fromRequire)) {
			return fromRequire;
		}
	}

	const imported = await import("libsodium-wrappers-sumo");
	if ("default" in imported && isSodiumModule(imported.default)) {
		return imported.default;
	}

	throw new Error("Failed to load libsodium-wrappers-sumo");
}

export async function initE2eeCrypto(): Promise<void> {
	if (initialized) return;
	sodium = await loadSodium();
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
	return getSodium().to_base64(value, B64());
}

export function b64Decode(value: Base64): Uint8Array {
	return getSodium().from_base64(value, B64());
}

export function randomBytes(length: number): Uint8Array {
	return getSodium().randombytes_buf(length);
}

export function generateX25519KeyPair(): {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
} {
	return getSodium().crypto_kx_keypair();
}

export function scalarMult(
	privateKey: Uint8Array,
	publicKey: Uint8Array,
): Uint8Array {
	return getSodium().crypto_scalarmult(privateKey, publicKey);
}

export function hash32(input: Uint8Array): Uint8Array {
	return getSodium().crypto_generichash(32, input);
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
	return getSodium().crypto_auth_hmacsha256(message, key);
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
	const ciphertext = getSodium().crypto_aead_xchacha20poly1305_ietf_encrypt(
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
	const plain = getSodium().crypto_aead_xchacha20poly1305_ietf_decrypt(
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
