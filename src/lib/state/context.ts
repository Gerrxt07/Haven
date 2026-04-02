import { createStore } from "solid-js/store";

export type ActiveContextStore = {
	activeServerId: number | null;
	activeChannelId: number | null;
};

const [contextStore, setContextStore] = createStore<ActiveContextStore>({
	activeServerId: null,
	activeChannelId: null,
});

export function setActiveServer(serverId: number | null): void {
	setContextStore("activeServerId", serverId);
}

export function setActiveChannel(channelId: number | null): void {
	setContextStore("activeChannelId", channelId);
}

export { contextStore };
