import type { PresenceEvent } from "../api";
import { authSession } from "../auth/session";
import { safeWarn } from "../security/redaction";
import {
	applyPresence,
	markHeartbeat,
	pushEvent,
	setConnectionState,
	setSubscribedChannels,
} from "./store";

type EventHandler = (event: PresenceEvent) => void;

function isPresenceEvent(value: unknown): value is PresenceEvent {
	if (!value || typeof value !== "object") {
		return false;
	}
	const event = value as Record<string, unknown>;
	return (
		typeof event.event_type === "string" &&
		typeof event.ts === "number" &&
		typeof event.payload === "object" &&
		event.payload !== null
	);
}

function resolveWsUrl(): string {
	const httpBase = "https://havenapi.becloudly.eu/api/v1";
	const wsBase = httpBase.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
	return `${wsBase}/ws`;
}

export class RealtimeManager {
	private socket: WebSocket | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null =
		null;
	private heartbeatTimer: ReturnType<typeof globalThis.setInterval> | null =
		null;
	private pingTimer: ReturnType<typeof globalThis.setInterval> | null = null;
	private readonly handlers = new Set<EventHandler>();
	private readonly handlersByEvent = new Map<string, Set<EventHandler>>();
	private readonly subscribedChannels = new Set<string>();
	private manuallyClosed = false;

	connect(): void {
		if (
			this.socket &&
			(this.socket.readyState === WebSocket.OPEN ||
				this.socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		this.manuallyClosed = false;
		setConnectionState(
			this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
			{
				attempt: this.reconnectAttempts,
				lastError: null,
			},
		);

		const url = resolveWsUrl();
		const socket = new WebSocket(url);
		this.socket = socket;

		socket.addEventListener("open", () => {
			this.reconnectAttempts = 0;
			setConnectionState("connected", { attempt: 0, lastError: null });
			this.sendAuthenticate();
			this.startHeartbeatLoop();
			this.flushSubscriptions();
		});

		socket.addEventListener("message", (message) => {
			this.handleMessage(message.data);
		});

		socket.addEventListener("error", () => {
			setConnectionState("error", { lastError: "websocket error" });
		});

		socket.addEventListener("close", () => {
			this.stopHeartbeatLoop();
			this.socket = null;
			if (this.manuallyClosed) {
				setConnectionState("disconnected", { lastError: null });
				return;
			}
			this.scheduleReconnect();
		});
	}

	disconnect(): void {
		this.manuallyClosed = true;
		if (this.reconnectTimer !== null) {
			globalThis.clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.stopHeartbeatLoop();

		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}

		setConnectionState("disconnected", { lastError: null });
	}

	subscribe(handler: EventHandler): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	on(eventType: string, handler: EventHandler): () => void {
		const set = this.handlersByEvent.get(eventType) ?? new Set<EventHandler>();
		set.add(handler);
		this.handlersByEvent.set(eventType, set);
		return () => {
			const next = this.handlersByEvent.get(eventType);
			if (!next) {
				return;
			}
			next.delete(handler);
			if (next.size === 0) {
				this.handlersByEvent.delete(eventType);
			}
		};
	}

	subscribeChannel(channelId: number | string, userId?: number): void {
		const channel = String(channelId);
		this.subscribedChannels.add(channel);
		setSubscribedChannels(Array.from(this.subscribedChannels));
		void userId;
		this.send({ type: "join", channel });
	}

	unsubscribeChannel(channelId: number | string): void {
		const channel = String(channelId);
		this.subscribedChannels.delete(channel);
		setSubscribedChannels(Array.from(this.subscribedChannels));
		this.send({ type: "broadcast", channel, payload: { action: "leave" } });
	}

	sendPresence(
		userId: number,
		status: "online" | "away" | "busy" | "offline",
	): void {
		void userId;
		this.send({ type: "presence", status });
	}

	sendBroadcast(
		channelId: number | string,
		payload: Record<string, unknown>,
		userId?: number,
	): void {
		void userId;
		this.send({
			type: "broadcast",
			channel: String(channelId),
			payload,
		});
	}

	private flushSubscriptions(): void {
		for (const channel of this.subscribedChannels) {
			this.send({ type: "join", channel });
		}
	}

	private sendAuthenticate(): void {
		const token = authSession.accessToken?.trim();
		if (!token) {
			return;
		}

		this.send({ type: "authenticate", token });
	}

	private scheduleReconnect(): void {
		this.reconnectAttempts += 1;
		const base = Math.min(
			30_000,
			500 * 2 ** Math.min(6, this.reconnectAttempts),
		);
		const jitter = Math.floor(Math.random() * 200);
		const delay = base + jitter;

		setConnectionState("reconnecting", {
			attempt: this.reconnectAttempts,
			lastError: `reconnecting in ${delay}ms`,
		});

		if (this.reconnectTimer !== null) {
			globalThis.clearTimeout(this.reconnectTimer);
		}
		this.reconnectTimer = globalThis.setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}

	private startHeartbeatLoop(): void {
		this.stopHeartbeatLoop();

		this.pingTimer = globalThis.setInterval(() => {
			this.send({ type: "ping" });
		}, 25_000);

		this.heartbeatTimer = globalThis.setInterval(() => {
			markHeartbeat();
		}, 10_000);
	}

	private stopHeartbeatLoop(): void {
		if (this.pingTimer !== null) {
			globalThis.clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
		if (this.heartbeatTimer !== null) {
			globalThis.clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private send(payload: Record<string, unknown>): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}
		this.socket.send(JSON.stringify(payload));
	}

	private handleMessage(raw: string): void {
		let parsed: unknown = null;
		try {
			parsed = JSON.parse(raw);
		} catch {
			safeWarn("Ignoring invalid websocket message", { raw });
			return;
		}
		if (!isPresenceEvent(parsed)) {
			safeWarn("Ignoring websocket event with invalid schema", { parsed });
			return;
		}

		pushEvent(parsed);
		if (parsed.event_type === "presence" && parsed.user_id) {
			const status =
				typeof parsed.payload.status === "string"
					? parsed.payload.status
					: "online";
			applyPresence(parsed.user_id, status);
		}

		for (const handler of this.handlers) {
			handler(parsed);
		}

		const typed = this.handlersByEvent.get(parsed.event_type);
		if (typed) {
			for (const handler of typed) {
				handler(parsed);
			}
		}
	}
}

export const realtimeManager = new RealtimeManager();
