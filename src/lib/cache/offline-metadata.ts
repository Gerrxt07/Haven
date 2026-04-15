import type { MessageDto } from "../api";
import { nativeApp } from "../native";

const CACHE_NAMESPACE = "offline-cache";
const CACHE_KEY = "messages-cache-key";

type MessageMetadata = Pick<
	MessageDto,
	| "id"
	| "channel_id"
	| "author_user_id"
	| "is_encrypted"
	| "created_at"
	| "updated_at"
>;

function encode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function decode(value: string): Uint8Array {
	const bin = atob(value);
	return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

async function getOrCreateCacheKey(): Promise<CryptoKey> {
	const existing = await nativeApp.secureStoreGet(CACHE_NAMESPACE, CACHE_KEY);

	if (existing) {
		const keyBytes = decode(existing);
		return crypto.subtle.importKey(
			"raw",
			toArrayBuffer(keyBytes),
			"AES-GCM",
			false,
			["encrypt", "decrypt"],
		);
	}

	const key = crypto.getRandomValues(new Uint8Array(32));
	await nativeApp.secureStoreSet(CACHE_NAMESPACE, CACHE_KEY, encode(key));
	return crypto.subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}

export async function persistChannelMetadata(
	channelId: number,
	messages: MessageDto[],
): Promise<void> {
	if (messages.length === 0) {
		return;
	}

	const metadata: MessageMetadata[] = messages.map((message) => ({
		id: message.id,
		channel_id: message.channel_id,
		author_user_id: message.author_user_id,
		is_encrypted: message.is_encrypted,
		created_at: message.created_at,
		updated_at: message.updated_at,
	}));

	const key = await getOrCreateCacheKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(metadata));
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
	);

	const payload = JSON.stringify({ iv: encode(iv), data: encode(ciphertext) });
	await nativeApp.secureStoreSet(
		CACHE_NAMESPACE,
		`channel:${channelId}`,
		payload,
	);
}

export async function loadChannelMetadata(
	channelId: number,
): Promise<MessageDto[] | null> {
	const raw = await nativeApp.secureStoreGet(
		CACHE_NAMESPACE,
		`channel:${channelId}`,
	);
	if (!raw) {
		return null;
	}

	const payload = JSON.parse(raw) as { iv: string; data: string };
	const key = await getOrCreateCacheKey();
	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: toArrayBuffer(decode(payload.iv)) },
		key,
		toArrayBuffer(decode(payload.data)),
	);
	const metadata = JSON.parse(
		new TextDecoder().decode(plaintext),
	) as MessageMetadata[];

	return metadata.map((item) => ({
		...item,
		content: "",
		ciphertext: null,
		nonce: null,
		aad: null,
		algorithm: null,
		edited_at: null,
		deleted_at: null,
	}));
}
