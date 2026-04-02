import { createStore } from "solid-js/store";

import type { PresenceEvent, RealtimeConnectionState } from "../api";

export type RealtimeStore = {
	connectionState: RealtimeConnectionState;
	attempt: number;
	lastError: string | null;
	lastHeartbeatAt: number | null;
	subscribedChannels: string[];
	presenceByUser: Record<string, string>;
	lastEvents: PresenceEvent[];
};

const [realtimeStore, setRealtimeStore] = createStore<RealtimeStore>({
	connectionState: "idle",
	attempt: 0,
	lastError: null,
	lastHeartbeatAt: null,
	subscribedChannels: [],
	presenceByUser: {},
	lastEvents: [],
});

export function setConnectionState(
	state: RealtimeConnectionState,
	meta?: { attempt?: number; lastError?: string | null },
): void {
	setRealtimeStore("connectionState", state);
	if (meta?.attempt !== undefined) {
		setRealtimeStore("attempt", meta.attempt);
	}
	if (meta?.lastError !== undefined) {
		setRealtimeStore("lastError", meta.lastError);
	}
}

export function setSubscribedChannels(channels: string[]): void {
	setRealtimeStore("subscribedChannels", channels);
}

export function markHeartbeat(): void {
	setRealtimeStore("lastHeartbeatAt", Date.now());
}

export function applyPresence(userId: number, status: string): void {
	setRealtimeStore("presenceByUser", String(userId), status);
}

export function pushEvent(event: PresenceEvent): void {
	setRealtimeStore("lastEvents", (events) => {
		const next = [...events, event];
		return next.slice(-200);
	});
}

export { realtimeStore };
