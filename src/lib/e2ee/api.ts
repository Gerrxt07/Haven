import { safeWarn } from "../security/redaction";
import type {
	ClaimedBundle,
	KeyBundleUploadPayload,
	PublicBundle,
	SessionEnvelope,
} from "./types";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function assertPublicBundle(value: unknown): asserts value is PublicBundle {
	assert(!!value && typeof value === "object", "invalid public bundle");
	const v = value as Record<string, unknown>;
	assert(typeof v.user_id === "number", "invalid public bundle user_id");
	assert(typeof v.identity_key === "string", "invalid identity_key");
	assert(
		typeof v.identity_signing_key === "string",
		"invalid identity_signing_key",
	);
	assert(typeof v.signed_prekey_id === "number", "invalid signed_prekey_id");
	assert(typeof v.signed_prekey === "string", "invalid signed_prekey");
	assert(
		typeof v.signed_prekey_signature === "string",
		"invalid signed_prekey_signature",
	);
}

function assertClaimedBundle(value: unknown): asserts value is ClaimedBundle {
	assertPublicBundle(value);
	const v = value as Record<string, unknown>;
	assert(
		typeof v.one_time_prekey_id === "number",
		"invalid one_time_prekey_id",
	);
	assert(typeof v.one_time_prekey === "string", "invalid one_time_prekey");
}

type ApiRequestInit = RequestInit & { token?: string | null };

const API_BASE_URL = "https://havenapi.becloudly.eu/api/v1";

async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("content-type", "application/json");
	if (init?.token) {
		headers.set("authorization", `Bearer ${init.token}`);
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers,
	});

	if (!response.ok) {
		let error = `HTTP ${response.status}`;
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) {
				error = body.error;
			}
		} catch {
			// ignore
		}
		safeWarn("E2EE API request failed", {
			path,
			status: response.status,
			error,
		});
		throw new Error(error);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export async function uploadKeyBundle(
	payload: KeyBundleUploadPayload,
): Promise<void> {
	await apiFetch<{ ok: boolean }>("/e2ee/keys/bundle", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function getPublicBundle(userId: number): Promise<PublicBundle> {
	const bundle = await apiFetch<PublicBundle>(`/e2ee/keys/bundle/${userId}`, {
		method: "GET",
	});
	assertPublicBundle(bundle);
	return bundle;
}

export async function claimBundle(
	requesterUserId: number,
	targetUserId: number,
): Promise<ClaimedBundle> {
	const bundle = await apiFetch<ClaimedBundle>("/e2ee/keys/claim", {
		method: "POST",
		body: JSON.stringify({
			requester_user_id: requesterUserId,
			target_user_id: targetUserId,
		}),
	});
	assertClaimedBundle(bundle);
	return bundle;
}

export async function sendEncryptedMessage(input: {
	channelId: number;
	authorUserId: number;
	envelope: SessionEnvelope;
	recipientKeyBoxes: Array<{
		recipient_user_id: number;
		encrypted_message_key: string;
		one_time_prekey_id?: number;
	}>;
}): Promise<void> {
	await apiFetch("/messages", {
		method: "POST",
		body: JSON.stringify({
			channel_id: input.channelId,
			author_user_id: input.authorUserId,
			ciphertext: input.envelope.ciphertext,
			nonce: input.envelope.nonce,
			aad: input.envelope.aad,
			algorithm: input.envelope.algorithm,
			recipient_key_boxes: input.recipientKeyBoxes,
		}),
	});
}
