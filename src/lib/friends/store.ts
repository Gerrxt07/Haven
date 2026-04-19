import { createStore } from "solid-js/store";
import type { FriendDto, FriendRequestDto } from "../api";
import {
	assertFriendDtoList,
	assertFriendRequestDtoList,
} from "../api/validation";

const CACHE_NAMESPACE = "friends-cache";
const INCOMING_CACHE_KEY = "requests.incoming";
const OUTGOING_CACHE_KEY = "requests.outgoing";
const FRIENDS_CACHE_KEY = "friends";
const PERSIST_DEBOUNCE_MS = 300;

export type FriendsStore = {
	incoming: FriendRequestDto[];
	outgoing: FriendRequestDto[];
	friends: FriendDto[];
	loading: boolean;
	error: string | null;
};

const [friendsStore, setFriendsStore] = createStore<FriendsStore>({
	incoming: [],
	outgoing: [],
	friends: [],
	loading: false,
	error: null,
});

export function setFriendsLoading(loading: boolean): void {
	setFriendsStore("loading", loading);
}

export function setFriendsError(error: string | null): void {
	setFriendsStore("error", error);
}

export function setIncomingRequests(requests: FriendRequestDto[]): void {
	setFriendsStore("incoming", requests);
	void persistIncoming(requests);
}

export function setOutgoingRequests(requests: FriendRequestDto[]): void {
	setFriendsStore("outgoing", requests);
	void persistOutgoing(requests);
}

export function setFriends(friends: FriendDto[]): void {
	setFriendsStore("friends", friends);
	void persistFriends(friends);
}

export function upsertIncomingRequest(request: FriendRequestDto): void {
	setFriendsStore("incoming", (prev) => {
		const filtered = prev.filter((r) => r.id !== request.id);
		if (request.status === "pending") {
			const next = [request, ...filtered];
			void persistIncoming(next);
			return next;
		}
		void persistIncoming(filtered);
		return filtered;
	});
}

export function upsertOutgoingRequest(request: FriendRequestDto): void {
	setFriendsStore("outgoing", (prev) => {
		const filtered = prev.filter((r) => r.id !== request.id);
		if (request.status === "pending") {
			const next = [request, ...filtered];
			void persistOutgoing(next);
			return next;
		}
		void persistOutgoing(filtered);
		return filtered;
	});
}

export function addFriend(friend: FriendDto): void {
	setFriendsStore("friends", (prev) => {
		if (prev.some((f) => f.id === friend.id)) {
			return prev;
		}
		const next = [friend, ...prev];
		void persistFriends(next);
		return next;
	});
}

// ── SecureStore persistence helpers ─────────────────────────────────────────

function getElectronApi(): NonNullable<
	(typeof globalThis)["electronAPI"]
> | null {
	return globalThis.electronAPI ?? null;
}

const pendingPayloadByKey = new Map<string, string>();
const persistTimers = new Map<
	string,
	ReturnType<typeof globalThis.setTimeout>
>();

async function flushPersistKey(key: string): Promise<void> {
	const timer = persistTimers.get(key);
	if (timer) {
		globalThis.clearTimeout(timer);
		persistTimers.delete(key);
	}

	const payload = pendingPayloadByKey.get(key);
	if (!payload) {
		return;
	}
	pendingPayloadByKey.delete(key);

	const api = getElectronApi();
	if (!api) {
		return;
	}

	try {
		await api.secureStoreSet(CACHE_NAMESPACE, key, payload);
	} catch {
		// Non-critical – cache write failures should not surface to the user
	}
}

function schedulePersist(key: string, payload: string): void {
	pendingPayloadByKey.set(key, payload);
	const existingTimer = persistTimers.get(key);
	if (existingTimer) {
		globalThis.clearTimeout(existingTimer);
	}

	const timer = globalThis.setTimeout(() => {
		void flushPersistKey(key);
	}, PERSIST_DEBOUNCE_MS);
	persistTimers.set(key, timer);
}

async function persistIncoming(requests: FriendRequestDto[]): Promise<void> {
	const api = getElectronApi();
	if (!api) return;
	// Only persist pending requests — processed ones must not survive in cache
	const pending = requests.filter((r) => r.status === "pending");
	schedulePersist(INCOMING_CACHE_KEY, JSON.stringify(pending));
}

async function persistOutgoing(requests: FriendRequestDto[]): Promise<void> {
	const api = getElectronApi();
	if (!api) return;
	// Only persist pending requests — processed ones must not survive in cache
	const pending = requests.filter((r) => r.status === "pending");
	schedulePersist(OUTGOING_CACHE_KEY, JSON.stringify(pending));
}

async function persistFriends(friends: FriendDto[]): Promise<void> {
	const api = getElectronApi();
	if (!api) return;
	schedulePersist(FRIENDS_CACHE_KEY, JSON.stringify(friends));
}

export async function loadFriendsFromCache(): Promise<void> {
	const api = getElectronApi();
	if (!api) return;

	try {
		const [rawIncoming, rawOutgoing, rawFriends] = await Promise.all([
			api.secureStoreGet(CACHE_NAMESPACE, INCOMING_CACHE_KEY),
			api.secureStoreGet(CACHE_NAMESPACE, OUTGOING_CACHE_KEY),
			api.secureStoreGet(CACHE_NAMESPACE, FRIENDS_CACHE_KEY),
		]);

		if (rawIncoming) {
			const parsed: unknown = JSON.parse(rawIncoming);
			assertFriendRequestDtoList(parsed);
			setFriendsStore(
				"incoming",
				parsed.filter((r) => r.status === "pending"),
			);
		}
		if (rawOutgoing) {
			const parsed: unknown = JSON.parse(rawOutgoing);
			assertFriendRequestDtoList(parsed);
			setFriendsStore(
				"outgoing",
				parsed.filter((r) => r.status === "pending"),
			);
		}
		if (rawFriends) {
			const parsed: unknown = JSON.parse(rawFriends);
			assertFriendDtoList(parsed);
			setFriendsStore("friends", parsed);
		}
	} catch {
		// Cache may be corrupted – silently ignore and rely on fresh server data
	}
}

export { friendsStore };
