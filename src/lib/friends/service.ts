import {
	apiAcceptFriendRequest,
	apiDeclineFriendRequest,
	apiGetFriends,
	apiGetIncomingFriendRequests,
	apiGetOutgoingFriendRequests,
	apiSendFriendRequest,
	type FriendRequestDto,
	HttpApiError,
	type PresenceEvent,
} from "../api";
import { authSession } from "../auth/session";
import { realtimeManager } from "../realtime";
import {
	addFriend,
	loadFriendsFromCache,
	setFriends,
	setFriendsError,
	setFriendsLoading,
	setIncomingRequests,
	setOutgoingRequests,
	upsertIncomingRequest,
	upsertOutgoingRequest,
} from "./store";

function isFriendRequestPayload(
	payload: Record<string, unknown>,
): payload is { request: FriendRequestDto } {
	return (
		payload.request !== null &&
		typeof payload.request === "object" &&
		typeof (payload.request as Record<string, unknown>).id === "number"
	);
}

function isFriendPayload(payload: Record<string, unknown>): payload is {
	id: number;
	user_id: number;
	friend_user_id: number;
	friend_username: string;
	friend_display_name: string;
	friend_avatar_url?: string | null;
	created_at: string;
} {
	return (
		typeof payload.id === "number" &&
		typeof payload.friend_user_id === "number" &&
		typeof payload.friend_username === "string"
	);
}

function getCurrentUserId(): number | null {
	return authSession.snapshot().currentUser?.id ?? null;
}

class FriendsService {
	private wsUnsubscribers: Array<() => void> = [];
	private initialized = false;

	async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		await loadFriendsFromCache();
		this.setupRealtimeHandlers();
		await this.refresh();
	}

	private setupRealtimeHandlers(): void {
		const unsubReceived = realtimeManager.on(
			"friend_request_received",
			(event: PresenceEvent) => {
				if (isFriendRequestPayload(event.payload)) {
					const currentUserId = getCurrentUserId();
					if (currentUserId === null) return;

					const { request } = event.payload;
					if (request.to_user_id === currentUserId) {
						upsertIncomingRequest(request);
						return;
					}

					if (request.from_user_id === currentUserId) {
						upsertOutgoingRequest(request);
					}
				}
			},
		);

		const unsubAccepted = realtimeManager.on(
			"friend_request_accepted",
			(event: PresenceEvent) => {
				if (isFriendRequestPayload(event.payload)) {
					const currentUserId = getCurrentUserId();
					if (currentUserId === null) return;

					const { request } = event.payload;
					if (request.from_user_id === currentUserId) {
						upsertOutgoingRequest(request);
					}
					if (request.to_user_id === currentUserId) {
						upsertIncomingRequest(request);
					}
				}
				if (isFriendPayload(event.payload)) {
					addFriend(event.payload);
				}
			},
		);

		const unsubDeclined = realtimeManager.on(
			"friend_request_declined",
			(event: PresenceEvent) => {
				if (isFriendRequestPayload(event.payload)) {
					const currentUserId = getCurrentUserId();
					if (currentUserId === null) return;

					const { request } = event.payload;
					if (request.from_user_id === currentUserId) {
						upsertOutgoingRequest(request);
					}
					if (request.to_user_id === currentUserId) {
						upsertIncomingRequest(request);
					}
				}
			},
		);

		this.wsUnsubscribers.push(unsubReceived, unsubAccepted, unsubDeclined);
	}

	async refresh(): Promise<void> {
		setFriendsLoading(true);
		setFriendsError(null);

		try {
			const [incoming, outgoing, friends] = await Promise.all([
				apiGetIncomingFriendRequests(),
				apiGetOutgoingFriendRequests(),
				apiGetFriends(),
			]);
			setIncomingRequests(incoming);
			setOutgoingRequests(outgoing);
			setFriends(friends);
		} catch (error) {
			const message =
				error instanceof HttpApiError
					? error.apiError.message
					: "Failed to load friends data";
			setFriendsError(message);
		} finally {
			setFriendsLoading(false);
		}
	}

	async sendRequest(
		username: string,
	): Promise<{ ok: boolean; error?: string }> {
		try {
			const request = await apiSendFriendRequest({ username });
			upsertOutgoingRequest(request);
			return { ok: true };
		} catch (error) {
			const message =
				error instanceof HttpApiError
					? error.apiError.message
					: "Failed to send friend request";
			return { ok: false, error: message };
		}
	}

	async acceptRequest(
		requestId: number,
	): Promise<{ ok: boolean; error?: string }> {
		try {
			const request = await apiAcceptFriendRequest(requestId);
			upsertIncomingRequest(request);
			return { ok: true };
		} catch (error) {
			const message =
				error instanceof HttpApiError
					? error.apiError.message
					: "Failed to accept friend request";
			return { ok: false, error: message };
		}
	}

	async declineRequest(
		requestId: number,
	): Promise<{ ok: boolean; error?: string }> {
		try {
			const request = await apiDeclineFriendRequest(requestId);
			upsertIncomingRequest(request);
			return { ok: true };
		} catch (error) {
			const message =
				error instanceof HttpApiError
					? error.apiError.message
					: "Failed to decline friend request";
			return { ok: false, error: message };
		}
	}

	destroy(): void {
		for (const unsub of this.wsUnsubscribers) {
			unsub();
		}
		this.wsUnsubscribers = [];
		this.initialized = false;
	}
}

export const friendsService = new FriendsService();
