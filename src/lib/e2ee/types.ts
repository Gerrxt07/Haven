export type Base64 = string;

export type E2eeHeader = {
	dhPub: Base64;
	pn: number;
	n: number;
};

export type RatchetState = {
	rootKey: Base64;
	sendingChainKey: Base64 | null;
	receivingChainKey: Base64 | null;
	dhSelfPrivate: Base64;
	dhSelfPublic: Base64;
	dhRemotePublic: Base64;
	sendCount: number;
	recvCount: number;
	prevChainLength: number;
	skippedMessageKeys: Record<string, Base64>;
};

export type SessionEnvelope = {
	header: E2eeHeader;
	nonce: Base64;
	ciphertext: Base64;
	aad: Base64;
	algorithm: "xchacha20poly1305";
};

export type IdentityKeyPair = {
	publicKey: Base64;
	privateKey: Base64;
	signingPublicKey: Base64;
	signingPrivateKey: Base64;
};

export type KeyBundleUploadPayload = {
	user_id: number;
	identity_key: Base64;
	identity_signing_key: Base64;
	signed_prekey_id: number;
	signed_prekey: Base64;
	signed_prekey_signature: Base64;
	one_time_prekeys: Array<{ id: number; prekey: Base64 }>;
};

export type PublicBundle = {
	user_id: number;
	identity_key: Base64;
	identity_signing_key: Base64;
	signed_prekey_id: number;
	signed_prekey: Base64;
	signed_prekey_signature: Base64;
};

export type ClaimedBundle = PublicBundle & {
	one_time_prekey_id: number;
	one_time_prekey: Base64;
};
