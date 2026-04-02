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
	ensureChannel(channelId);
	setChatStore("messagesByChannel", String(channelId), (current) => {
		const map = { ...current.byId };
		for (const item of incoming) {
			map[String(item.id)] = item;
		}
		const items = Object.values(map).sort((a, b) => b.id - a.id);
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
