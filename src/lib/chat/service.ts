import {
	apiCreateChannel,
	apiCreateMessage,
	apiCreateServer,
	apiListMessages,
	beginAbortableRequest,
	type ChannelDto,
	type CreateChannelRequestDto,
	type CreateMessageRequestDto,
	type CreateServerRequestDto,
	clearAbortRequest,
	type MessageDto,
	type ServerDto,
} from "../api";
import {
	loadChannelMetadata,
	persistChannelMetadata,
} from "../cache/offline-metadata";
import { primeRelatedUserAvatar } from "../cache/profile-images";
import { realtimeManager } from "../realtime";
import { setActiveChannel } from "../state";
import {
	getNextCursor,
	mergeMessages,
	setChannelLoading,
	upsertMessage,
} from "./store";

function pickAvatarFromPayload(
	payload: Record<string, unknown>,
): string | null {
	const candidates = [
		payload.author_avatar_url,
		payload.avatar_url,
		payload.profile_image_url,
		payload.profile_picture_url,
		payload.profile_picture,
		payload.image_url,
		payload.photo_url,
		payload.avatarUrl,
		payload.profilePictureUrl,
	];

	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate;
		}
	}

	return null;
}

class ChatSyncService {
	private attachedRealtime = false;

	attachRealtimeHandlers(): void {
		if (this.attachedRealtime) {
			return;
		}

		this.attachedRealtime = true;
		realtimeManager.on("new_message", (event) => {
			const payload = event.payload;
			const channelId = Number(event.payload.channel_id ?? event.channel);
			if (!Number.isFinite(channelId)) {
				return;
			}

			const messageId = Number(payload.message_id);
			const authorUserId = Number(payload.author_user_id);
			const createdAt = String(payload.created_at ?? new Date().toISOString());
			const authorAvatarUrl = pickAvatarFromPayload(payload);

			const message: MessageDto = {
				id: Number.isFinite(messageId) ? messageId : Date.now(),
				channel_id: channelId,
				author_user_id: Number.isFinite(authorUserId) ? authorUserId : 0,
				author_avatar_url: authorAvatarUrl,
				content: typeof payload.content === "string" ? payload.content : "",
				is_encrypted: Boolean(payload.is_encrypted),
				ciphertext:
					typeof payload.ciphertext === "string" ? payload.ciphertext : null,
				nonce: typeof payload.nonce === "string" ? payload.nonce : null,
				aad: typeof payload.aad === "string" ? payload.aad : null,
				algorithm:
					typeof payload.algorithm === "string" ? payload.algorithm : null,
				edited_at: null,
				deleted_at: null,
				created_at: createdAt,
				updated_at: createdAt,
			};

			upsertMessage(channelId, message);
			if (Number.isFinite(authorUserId)) {
				void primeRelatedUserAvatar(authorUserId, authorAvatarUrl);
			}
			void persistChannelMetadata(channelId, [message]);
		});
	}

	async createServer(payload: CreateServerRequestDto): Promise<ServerDto> {
		return apiCreateServer(payload);
	}

	async createChannel(payload: CreateChannelRequestDto): Promise<ChannelDto> {
		const created = await apiCreateChannel(payload);
		realtimeManager.subscribeChannel(created.id, payload.actor_user_id);
		return created;
	}

	async createMessageOptimistic(
		payload: CreateMessageRequestDto,
	): Promise<MessageDto> {
		const optimisticId = Date.now();
		const optimistic: MessageDto = {
			id: optimisticId,
			channel_id: payload.channel_id,
			author_user_id: payload.author_user_id,
			content: payload.content ?? "",
			is_encrypted: Boolean(payload.ciphertext),
			ciphertext: payload.ciphertext ?? null,
			nonce: payload.nonce ?? null,
			aad: payload.aad ?? null,
			algorithm: payload.algorithm ?? null,
			edited_at: null,
			deleted_at: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		upsertMessage(payload.channel_id, optimistic);
		const persisted = await apiCreateMessage(payload);
		upsertMessage(payload.channel_id, persisted);
		void persistChannelMetadata(payload.channel_id, [persisted]);
		return persisted;
	}

	async loadNextMessagesPage(
		channelId: number,
		limit = 50,
	): Promise<MessageDto[]> {
		const requestKey = `messages:${channelId}`;
		const signal = beginAbortableRequest(requestKey);
		setChannelLoading(channelId, true);

		try {
			const before = getNextCursor(channelId) ?? undefined;
			const rows = await apiListMessages({
				channelId,
				before,
				limit,
				signal,
			});
			for (const row of rows) {
				void primeRelatedUserAvatar(
					row.author_user_id,
					row.author_avatar_url ?? null,
				);
			}
			mergeMessages(channelId, rows);
			void persistChannelMetadata(channelId, rows);
			return rows;
		} finally {
			setChannelLoading(channelId, false);
			clearAbortRequest(requestKey);
		}
	}

	switchChannel(channelId: number, userId?: number): void {
		setActiveChannel(channelId);
		realtimeManager.subscribeChannel(channelId, userId);
		void this.hydrateChannelFromOfflineCache(channelId);
	}

	leaveChannel(channelId: number): void {
		setActiveChannel(null);
		realtimeManager.unsubscribeChannel(channelId);
	}

	private async hydrateChannelFromOfflineCache(
		channelId: number,
	): Promise<void> {
		const cached = await loadChannelMetadata(channelId);
		if (!cached || cached.length === 0) {
			return;
		}
		mergeMessages(channelId, cached);
	}
}

export const chatSyncService = new ChatSyncService();
