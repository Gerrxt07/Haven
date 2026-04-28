import {
	apiCreateDmMessage,
	apiCreateDmThread,
	apiListDmMessages,
	apiListDmThreads,
	beginAbortableRequest,
	clearAbortRequest,
	type DmMessageDto,
	type DmThreadDto,
	HttpApiError,
} from "../api";
import { authSession } from "../auth/session";
import { decryptDmMessage, encryptDmMessage } from "../e2ee/client";
import { realtimeManager } from "../realtime";
import {
	dmStore,
	getDmNextCursor,
	mergeDmMessages,
	patchDmThreadFromMessage,
	setDmActiveThread,
	setDmError,
	setDmLoadingThreads,
	setDmThreadLoading,
	setDmThreads,
	upsertDmMessage,
	upsertDmThread,
} from "./store";

function extractDmMessage(
	payload: Record<string, unknown>,
): DmMessageDto | null {
	if (typeof payload.id !== "number" || typeof payload.thread_id !== "number") {
		return null;
	}
	if (typeof payload.author_user_id !== "number") {
		return null;
	}
	if (typeof payload.content !== "string") {
		return null;
	}
	if (
		typeof payload.created_at !== "string" ||
		typeof payload.updated_at !== "string"
	) {
		return null;
	}

	return {
		id: payload.id,
		thread_id: payload.thread_id,
		author_user_id: payload.author_user_id,
		author_avatar_url:
			typeof payload.author_avatar_url === "string"
				? payload.author_avatar_url
				: null,
		content: payload.content,
		is_encrypted: Boolean(payload.is_encrypted),
		ciphertext:
			typeof payload.ciphertext === "string" ? payload.ciphertext : null,
		nonce: typeof payload.nonce === "string" ? payload.nonce : null,
		aad: typeof payload.aad === "string" ? payload.aad : null,
		algorithm: typeof payload.algorithm === "string" ? payload.algorithm : null,
		edited_at: typeof payload.edited_at === "string" ? payload.edited_at : null,
		deleted_at:
			typeof payload.deleted_at === "string" ? payload.deleted_at : null,
		created_at: payload.created_at,
		updated_at: payload.updated_at,
	};
}

class DmService {
	private initialized = false;
	private wsUnsubscribers: Array<() => void> = [];

	async init(): Promise<void> {
		if (this.initialized) {
			return;
		}
		this.initialized = true;

		this.setupRealtimeHandlers();
		await this.refreshThreads();
	}

	private setupRealtimeHandlers(): void {
		const unsub = realtimeManager.on("direct_message", (event) => {
			const message = extractDmMessage(event.payload);
			if (!message) {
				return;
			}
			void this.decryptMessageIfPossible(message).then((displayMessage) => {
				upsertDmMessage(displayMessage.thread_id, displayMessage);
				patchDmThreadFromMessage(displayMessage.thread_id, displayMessage);
			});
		});

		this.wsUnsubscribers.push(unsub);
	}

	private peerUserIdForThread(threadId: number): number | null {
		return (
			dmStore.threads.find((thread) => thread.id === threadId)?.peer_user_id ??
			null
		);
	}

	private async decryptMessageIfPossible(
		message: DmMessageDto,
	): Promise<DmMessageDto> {
		if (!message.is_encrypted) {
			return message;
		}
		if (!message.ciphertext || !message.nonce || !message.aad) {
			return message;
		}
		const selfUserId = authSession.currentUser?.id;
		const peerUserId = this.peerUserIdForThread(message.thread_id);
		if (!selfUserId || !peerUserId || message.author_user_id === selfUserId) {
			return message;
		}

		try {
			const plaintext = await decryptDmMessage({
				selfUserId,
				peerUserId,
				ciphertext: message.ciphertext,
				nonce: message.nonce,
				aad: message.aad,
				algorithm: message.algorithm,
			});
			return {
				...message,
				decrypted_content: plaintext,
			};
		} catch {
			return message;
		}
	}

	async refreshThreads(): Promise<void> {
		setDmLoadingThreads(true);
		setDmError(null);
		try {
			const threads = await apiListDmThreads({ limit: 50 });
			setDmThreads(threads);
			for (const thread of threads) {
				realtimeManager.subscribeChannel(`dm:${thread.id}`);
			}
		} catch (error) {
			const message =
				error instanceof HttpApiError
					? error.apiError.message
					: "Failed to load direct message threads";
			setDmError(message);
		} finally {
			setDmLoadingThreads(false);
		}
	}

	async ensureThreadWithPeer(peerUserId: number): Promise<DmThreadDto> {
		const existing = dmStore.threads.find(
			(thread) => thread.peer_user_id === peerUserId,
		);
		if (existing) {
			return existing;
		}

		const created = await apiCreateDmThread({ peer_user_id: peerUserId });
		upsertDmThread(created);
		realtimeManager.subscribeChannel(`dm:${created.id}`);
		return created;
	}

	async openThread(threadId: number): Promise<void> {
		setDmActiveThread(threadId);
		realtimeManager.subscribeChannel(`dm:${threadId}`);

		const local = dmStore.messagesByThread[String(threadId)];
		if (!local || local.items.length === 0) {
			await this.loadNextMessages(threadId, 50);
		}
	}

	async startThreadWithPeer(peerUserId: number): Promise<void> {
		const thread = await this.ensureThreadWithPeer(peerUserId);
		await this.openThread(thread.id);
	}

	async loadNextMessages(
		threadId: number,
		limit = 50,
	): Promise<DmMessageDto[]> {
		const requestKey = `dm:messages:${threadId}`;
		const signal = beginAbortableRequest(requestKey);
		setDmThreadLoading(threadId, true);

		try {
			const before = getDmNextCursor(threadId) ?? undefined;
			const rows = await apiListDmMessages({
				threadId,
				before,
				limit,
				signal,
			});
			const displayRows = await Promise.all(
				rows.map((row) => this.decryptMessageIfPossible(row)),
			);
			mergeDmMessages(threadId, displayRows);
			return displayRows;
		} finally {
			setDmThreadLoading(threadId, false);
			clearAbortRequest(requestKey);
		}
	}

	async sendMessage(
		threadId: number,
		authorUserId: number,
		content: string,
	): Promise<DmMessageDto> {
		const trimmed = content.trim();
		if (!trimmed) {
			throw new Error("message cannot be empty");
		}
		const thread = dmStore.threads.find((entry) => entry.id === threadId);
		if (!thread) {
			throw new Error("missing direct message thread");
		}
		const encrypted = await encryptDmMessage({
			selfUserId: authorUserId,
			peerUserId: thread.peer_user_id,
			plaintext: trimmed,
		});

		const optimisticId = Date.now();
		const now = new Date().toISOString();
		const optimistic: DmMessageDto = {
			id: optimisticId,
			thread_id: threadId,
			author_user_id: authorUserId,
			author_avatar_url: null,
			content: "[e2ee]",
			decrypted_content: trimmed,
			is_encrypted: true,
			ciphertext: encrypted.ciphertext,
			nonce: encrypted.nonce,
			aad: encrypted.aad,
			algorithm: encrypted.algorithm,
			edited_at: null,
			deleted_at: null,
			created_at: now,
			updated_at: now,
		};

		upsertDmMessage(threadId, optimistic);
		patchDmThreadFromMessage(threadId, optimistic);

		const created = await apiCreateDmMessage(threadId, encrypted);
		const displayCreated: DmMessageDto = {
			...created,
			decrypted_content: trimmed,
		};
		upsertDmMessage(threadId, displayCreated);
		patchDmThreadFromMessage(threadId, displayCreated);
		return displayCreated;
	}

	destroy(): void {
		for (const unsub of this.wsUnsubscribers) {
			unsub();
		}
		this.wsUnsubscribers = [];
		this.initialized = false;
	}
}

export const dmService = new DmService();
