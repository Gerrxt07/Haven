declare module "libsodium-wrappers-sumo" {
	const sodium: {
		ready: Promise<void>;
		randombytes_buf: (length: number) => Uint8Array;
		crypto_kx_keypair: () => { publicKey: Uint8Array; privateKey: Uint8Array };
		crypto_scalarmult: (
			privateKey: Uint8Array,
			publicKey: Uint8Array,
		) => Uint8Array;
		crypto_generichash: (length: number, input: Uint8Array) => Uint8Array;
		crypto_auth_hmacsha256: (
			message: Uint8Array,
			key: Uint8Array,
		) => Uint8Array;
		crypto_aead_xchacha20poly1305_ietf_encrypt: (
			message: Uint8Array,
			aad: Uint8Array | null,
			nsec: null,
			nonce: Uint8Array,
			key: Uint8Array,
		) => Uint8Array;
		crypto_aead_xchacha20poly1305_ietf_decrypt: (
			nsec: null,
			ciphertext: Uint8Array,
			aad: Uint8Array | null,
			nonce: Uint8Array,
			key: Uint8Array,
		) => Uint8Array;
		to_base64: (input: Uint8Array, variant?: number) => string;
		from_base64: (input: string, variant?: number) => Uint8Array;
		base64_variants: { ORIGINAL: number; URLSAFE_NO_PADDING: number };
	};

	export default sodium;
}
