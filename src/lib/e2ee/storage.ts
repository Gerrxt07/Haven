import type { IdentityKeyPair, RatchetState } from "./types";

const NS = "e2ee";

function assertElectronApi() {
	if (!globalThis.electronAPI) {
		throw new Error("electronAPI unavailable");
	}
}

export async function saveIdentity(
	userId: number,
	identity: IdentityKeyPair,
): Promise<void> {
	assertElectronApi();
	const ok = await globalThis.electronAPI.secureStoreSet(
		NS,
		`identity:${userId}`,
		JSON.stringify(identity),
	);
	if (!ok) {
		throw new Error("failed to persist identity keys");
	}
}

export async function loadIdentity(
	userId: number,
): Promise<IdentityKeyPair | null> {
	assertElectronApi();
	const value = await globalThis.electronAPI.secureStoreGet(
		NS,
		`identity:${userId}`,
	);
	if (!value) return null;
	return JSON.parse(value) as IdentityKeyPair;
}

export async function saveSignedPrekeyPrivate(
	userId: number,
	value: string,
): Promise<void> {
	assertElectronApi();
	const ok = await globalThis.electronAPI.secureStoreSet(
		NS,
		`signed-prekey:${userId}`,
		value,
	);
	if (!ok) {
		throw new Error("failed to persist signed prekey");
	}
}

export async function loadSignedPrekeyPrivate(
	userId: number,
): Promise<string | null> {
	assertElectronApi();
	return globalThis.electronAPI.secureStoreGet(NS, `signed-prekey:${userId}`);
}

export async function saveOneTimePrekeyPrivate(
	userId: number,
	prekeyId: number,
	value: string,
): Promise<void> {
	assertElectronApi();
	const ok = await globalThis.electronAPI.secureStoreSet(
		NS,
		`otp:${userId}:${prekeyId}`,
		value,
	);
	if (!ok) {
		throw new Error("failed to persist one-time prekey");
	}
}

export async function loadOneTimePrekeyPrivate(
	userId: number,
	prekeyId: number,
): Promise<string | null> {
	assertElectronApi();
	return globalThis.electronAPI.secureStoreGet(NS, `otp:${userId}:${prekeyId}`);
}

export async function deleteOneTimePrekeyPrivate(
	userId: number,
	prekeyId: number,
): Promise<void> {
	assertElectronApi();
	await globalThis.electronAPI.secureStoreDelete(
		NS,
		`otp:${userId}:${prekeyId}`,
	);
}

export async function saveRatchetState(
	conversationKey: string,
	state: RatchetState,
): Promise<void> {
	assertElectronApi();
	const ok = await globalThis.electronAPI.secureStoreSet(
		NS,
		`ratchet:${conversationKey}`,
		JSON.stringify(state),
	);
	if (!ok) {
		throw new Error("failed to persist ratchet state");
	}
}

export async function loadRatchetState(
	conversationKey: string,
): Promise<RatchetState | null> {
	assertElectronApi();
	const value = await globalThis.electronAPI.secureStoreGet(
		NS,
		`ratchet:${conversationKey}`,
	);
	if (!value) return null;
	return JSON.parse(value) as RatchetState;
}

export async function saveConversationSecret(
	conversationKey: string,
	secretB64: string,
): Promise<void> {
	assertElectronApi();
	const ok = await globalThis.electronAPI.secureStoreSet(
		NS,
		`conv-secret:${conversationKey}`,
		secretB64,
	);
	if (!ok) {
		throw new Error("failed to persist conversation secret");
	}
}

export async function loadConversationSecret(
	conversationKey: string,
): Promise<string | null> {
	assertElectronApi();
	return globalThis.electronAPI.secureStoreGet(
		NS,
		`conv-secret:${conversationKey}`,
	);
}
