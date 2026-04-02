import type {
	ClaimedBundle,
	KeyBundleUploadPayload,
	PublicBundle,
	SessionEnvelope,
} from "./types";

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
	return apiFetch<PublicBundle>(`/e2ee/keys/bundle/${userId}`, {
		method: "GET",
	});
}

export async function claimBundle(
	requesterUserId: number,
	targetUserId: number,
): Promise<ClaimedBundle> {
	return apiFetch<ClaimedBundle>("/e2ee/keys/claim", {
		method: "POST",
		body: JSON.stringify({
			requester_user_id: requesterUserId,
			target_user_id: targetUserId,
		}),
	});
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
