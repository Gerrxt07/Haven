import { createStore } from "solid-js/store";
import type { DmMessageDto, DmThreadDto } from "../api";

type ThreadMessageState = {
	items: DmMessageDto[];
	byId: Record<string, DmMessageDto>;
	nextCursor: number | null;
	loading: boolean;
};

export type DmStore = {
	threads: DmThreadDto[];
	messagesByThread: Record<string, ThreadMessageState>;
	activeThreadId: number | null;
	loadingThreads: boolean;
	error: string | null;
};

const [dmStore, setDmStore] = createStore<DmStore>({
	threads: [],
	messagesByThread: {},
	activeThreadId: null,
	loadingThreads: false,
	error: null,
});

function ensureThreadMessages(threadId: number): ThreadMessageState {
	const key = String(threadId);
	const existing = dmStore.messagesByThread[key];
	if (existing) {
		return existing;
	}

	const created: ThreadMessageState = {
		items: [],
		byId: {},
		nextCursor: null,
		loading: false,
	};
	setDmStore("messagesByThread", key, created);
	return created;
}

function sortThreads(threads: DmThreadDto[]): DmThreadDto[] {
	return [...threads].sort((a, b) => {
		const aTime = a.last_message_at ?? a.updated_at;
		const bTime = b.last_message_at ?? b.updated_at;
		return new Date(bTime).getTime() - new Date(aTime).getTime();
	});
}

export function setDmLoadingThreads(loading: boolean): void {
	setDmStore("loadingThreads", loading);
}

export function setDmError(error: string | null): void {
	setDmStore("error", error);
}

export function setDmActiveThread(threadId: number | null): void {
	setDmStore("activeThreadId", threadId);
}

export function setDmThreads(threads: DmThreadDto[]): void {
	setDmStore("threads", sortThreads(threads));
}

export function upsertDmThread(thread: DmThreadDto): void {
	setDmStore("threads", (prev) => {
		const filtered = prev.filter((entry) => entry.id !== thread.id);
		return sortThreads([thread, ...filtered]);
	});
}

export function patchDmThreadFromMessage(
	threadId: number,
	message: DmMessageDto,
): void {
	setDmStore("threads", (prev) => {
		const existing = prev.find((entry) => entry.id === threadId);
		if (!existing) {
			return prev;
		}

		const patch: DmThreadDto = {
			...existing,
			last_message_preview: message.is_encrypted
				? "Encrypted message"
				: message.content,
			last_message_at: message.created_at,
			updated_at: message.updated_at,
		};
		const filtered = prev.filter((entry) => entry.id !== threadId);
		return sortThreads([patch, ...filtered]);
	});
}

export function setDmThreadLoading(threadId: number, loading: boolean): void {
	ensureThreadMessages(threadId);
	setDmStore("messagesByThread", String(threadId), "loading", loading);
}

export function mergeDmMessages(
	threadId: number,
	incoming: DmMessageDto[],
): void {
	if (incoming.length === 0) {
		return;
	}
	ensureThreadMessages(threadId);
	setDmStore("messagesByThread", String(threadId), (current) => {
		const map = { ...current.byId };
		const items = [...current.items];

		for (const incomingItem of incoming) {
			const idKey = String(incomingItem.id);
			const hadExisting = map[idKey] !== undefined;
			map[idKey] = incomingItem;

			if (hadExisting) {
				const existingIndex = items.findIndex(
					(entry) => entry.id === incomingItem.id,
				);
				if (existingIndex >= 0) {
					items[existingIndex] = incomingItem;
					continue;
				}
			}

			let left = 0;
			let right = items.length;
			while (left < right) {
				const mid = (left + right) >> 1;
				if (items[mid].id > incomingItem.id) {
					left = mid + 1;
				} else {
					right = mid;
				}
			}
			items.splice(left, 0, incomingItem);
		}

		const nextCursor = items.length > 0 ? items[items.length - 1].id : null;
		return {
			...current,
			byId: map,
			items,
			nextCursor,
		};
	});
}

export function upsertDmMessage(threadId: number, message: DmMessageDto): void {
	mergeDmMessages(threadId, [message]);
}

export function getDmNextCursor(threadId: number): number | null {
	const thread = dmStore.messagesByThread[String(threadId)];
	return thread?.nextCursor ?? null;
}

export { dmStore };
