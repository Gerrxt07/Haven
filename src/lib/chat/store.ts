import { createStore } from "solid-js/store";

import type { MessageDto } from "../api";

type ChannelMessageState = {
	items: MessageDto[];
	byId: Record<string, MessageDto>;
	nextCursor: number | null;
	loading: boolean;
};

export type ChatStore = {
	messagesByChannel: Record<string, ChannelMessageState>;
};

const [chatStore, setChatStore] = createStore<ChatStore>({
	messagesByChannel: {},
});

function ensureChannel(channelId: number): ChannelMessageState {
	const key = String(channelId);
	const existing = chatStore.messagesByChannel[key];
	if (existing) {
		return existing;
	}

	const created: ChannelMessageState = {
		items: [],
		byId: {},
		nextCursor: null,
		loading: false,
	};
	setChatStore("messagesByChannel", key, created);
	return created;
}

export function setChannelLoading(channelId: number, loading: boolean): void {
	ensureChannel(channelId);
	setChatStore("messagesByChannel", String(channelId), "loading", loading);
}

export function mergeMessages(channelId: number, incoming: MessageDto[]): void {
	if (incoming.length === 0) {
		return;
	}
	ensureChannel(channelId);
	setChatStore("messagesByChannel", String(channelId), (current) => {
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

export function upsertMessage(channelId: number, message: MessageDto): void {
	mergeMessages(channelId, [message]);
}

export function getNextCursor(channelId: number): number | null {
	const channel = chatStore.messagesByChannel[String(channelId)];
	return channel?.nextCursor ?? null;
}

export { chatStore };
