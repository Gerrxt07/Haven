import { afterEach, describe, expect, it } from "bun:test";
import type { MessageDto } from "../api";
import { chatStore, mergeMessages } from "../chat/store";
import { realtimeManager } from "../realtime/manager";
import { realtimeStore } from "../realtime/store";

type Listener = (event: { data?: string }) => void;

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];

	readonly listeners: Record<string, Listener[]> = {};
	readonly sent: string[] = [];
	readyState = FakeWebSocket.CONNECTING;

	constructor(_url: string) {
		FakeWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: Listener): void {
		this.listeners[type] ??= [];
		this.listeners[type].push(listener);
	}

	emit(type: string, payload: { data?: string } = {}): void {
		for (const listener of this.listeners[type] ?? []) {
			listener(payload);
		}
	}

	send(payload: string): void {
		this.sent.push(payload);
	}

	close(): void {
		this.readyState = FakeWebSocket.CLOSED;
		this.emit("close");
	}
}

const OriginalWebSocket = globalThis.WebSocket;

afterEach(() => {
	realtimeManager.disconnect();
	globalThis.WebSocket = OriginalWebSocket;
});

describe("Realtime integration", () => {
	it("routes websocket events in order and marks reconnecting on close", async () => {
		globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
		const received: string[] = [];
		realtimeManager.on("new_message", (event) => {
			received.push(String(event.payload.content));
		});

		realtimeManager.connect();
		const ws = FakeWebSocket.instances.at(-1);
		expect(ws).toBeDefined();
		if (!ws) {
			throw new Error("missing websocket instance");
		}
		ws.readyState = FakeWebSocket.OPEN;
		ws.emit("open");

		ws.emit("message", {
			data: JSON.stringify({
				event_type: "new_message",
				ts: Date.now(),
				payload: { content: "one" },
			}),
		});
		ws.emit("message", {
			data: JSON.stringify({
				event_type: "new_message",
				ts: Date.now(),
				payload: { content: "two" },
			}),
		});

		expect(received).toEqual(["one", "two"]);

		ws.emit("close");
		expect(realtimeStore.connectionState).toBe("reconnecting");
	});

	it("dedupes messages from REST + WS race by id", () => {
		const channelId = 99123;
		const messageA: MessageDto = {
			id: 123456,
			channel_id: channelId,
			author_user_id: 9,
			content: "hello",
			is_encrypted: false,
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
		};

		const messageB: MessageDto = {
			...messageA,
			content: "hello (ws)",
		};

		mergeMessages(channelId, [messageA]);
		mergeMessages(channelId, [messageB]);

		const channel = chatStore.messagesByChannel[String(channelId)];
		expect(channel.items.length).toBe(1);
		expect(channel.items[0]?.content).toBe("hello (ws)");
	});
});
