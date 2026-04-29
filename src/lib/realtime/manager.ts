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

const MAX_INCOMING_WS_MESSAGE_BYTES = 64 * 1024;
const PING_INTERVAL_MS = 10_000;
const PONG_TIMEOUT_MS = 15_000;
const HEARTBEAT_CHECK_MS = 2_000;
const KNOWN_EVENT_TYPES = new Set([
	"pong",
	"presence",
	"new_message",
	"direct_message",
	"friend_request_received",
	"friend_request_accepted",
	"friend_request_declined",
	"broadcast",
]);
const PRESENCE_STATUSES = new Set(["online", "away", "busy", "offline"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
	const allowed = new Set(keys);
	return Object.keys(value).every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isOptionalString(value: unknown): value is string | null | undefined {
	return value === undefined || value === null || isString(value);
}

function isOptionalNumber(value: unknown): value is number | null | undefined {
	return value === undefined || value === null || isFiniteNumber(value);
}

function isValidIsoLikeString(value: unknown): value is string {
	return isString(value) && value.length >= 10 && value.length <= 64;
}

function isValidFriendRequest(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	return (
		isFiniteNumber(value.id) &&
		isFiniteNumber(value.from_user_id) &&
		isString(value.from_username) &&
		isString(value.from_display_name) &&
		isFiniteNumber(value.to_user_id) &&
		isString(value.to_username) &&
		isString(value.to_display_name) &&
		isString(value.status) &&
		isValidIsoLikeString(value.created_at) &&
		isValidIsoLikeString(value.updated_at) &&
		isOptionalString(value.from_avatar_url)
	);
}

function isValidFriend(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	return (
		isFiniteNumber(value.id) &&
		isFiniteNumber(value.user_id) &&
		isFiniteNumber(value.friend_user_id) &&
		isString(value.friend_username) &&
		isString(value.friend_display_name) &&
		isValidIsoLikeString(value.created_at) &&
		isOptionalString(value.friend_avatar_url)
	);
}

function isValidEventPayload(eventType: string, payload: unknown): boolean {
	if (!isRecord(payload)) {
		return false;
	}

	switch (eventType) {
		case "pong":
			return (
				hasOnlyKeys(payload, ["status"]) && isOptionalString(payload.status)
			);
		case "presence":
			return (
				hasOnlyKeys(payload, ["status"]) &&
				isString(payload.status) &&
				PRESENCE_STATUSES.has(payload.status)
			);
		case "new_message":
			return (
				isFiniteNumber(payload.message_id) &&
				isFiniteNumber(payload.channel_id) &&
				isFiniteNumber(payload.author_user_id) &&
				typeof payload.is_encrypted === "boolean" &&
				isValidIsoLikeString(payload.created_at) &&
				isOptionalString(payload.author_avatar_url) &&
				isOptionalString(payload.content) &&
				isOptionalString(payload.ciphertext) &&
				isOptionalString(payload.nonce) &&
				isOptionalString(payload.aad) &&
				isOptionalString(payload.algorithm)
			);
		case "direct_message":
			return (
				isFiniteNumber(payload.id) &&
				isFiniteNumber(payload.thread_id) &&
				isFiniteNumber(payload.author_user_id) &&
				isString(payload.content) &&
				typeof payload.is_encrypted === "boolean" &&
				isValidIsoLikeString(payload.created_at) &&
				isValidIsoLikeString(payload.updated_at) &&
				isOptionalString(payload.author_avatar_url) &&
				isOptionalString(payload.ciphertext) &&
				isOptionalString(payload.nonce) &&
				isOptionalString(payload.aad) &&
				isOptionalString(payload.algorithm) &&
				isOptionalString(payload.edited_at) &&
				isOptionalString(payload.deleted_at)
			);
		case "friend_request_received":
		case "friend_request_declined":
			return (
				hasOnlyKeys(payload, ["request"]) &&
				isValidFriendRequest(payload.request)
			);
		case "friend_request_accepted":
			return (
				isValidFriendRequest(payload.request) &&
				(payload.friend === undefined || isValidFriend(payload.friend))
			);
		case "broadcast":
			return true;
		default:
			return false;
	}
}

function isPresenceEvent(value: unknown): value is PresenceEvent {
	if (!value || typeof value !== "object") {
		return false;
	}
	const event = value as Record<string, unknown>;
	if (
		!hasOnlyKeys(event, ["event_type", "user_id", "channel", "payload", "ts"])
	) {
		return false;
	}
	if (
		!isString(event.event_type) ||
		!KNOWN_EVENT_TYPES.has(event.event_type) ||
		!isFiniteNumber(event.ts) ||
		!isOptionalNumber(event.user_id) ||
		!isOptionalString(event.channel)
	) {
		return false;
	}
	return isValidEventPayload(event.event_type, event.payload);
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
	private lastPongAt: number | null = null;
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
		this.lastPongAt = Date.now();
		this.send({ type: "ping" });

		this.pingTimer = globalThis.setInterval(() => {
			this.send({ type: "ping" });
		}, PING_INTERVAL_MS);

		this.heartbeatTimer = globalThis.setInterval(() => {
			if (this.lastPongAt === null) {
				return;
			}
			const age = Date.now() - this.lastPongAt;
			if (age <= PONG_TIMEOUT_MS) {
				return;
			}

			setConnectionState("error", { lastError: "websocket heartbeat timeout" });
			this.socket?.close();
		}, HEARTBEAT_CHECK_MS);
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
		this.lastPongAt = null;
	}

	private send(payload: Record<string, unknown>): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}
		this.socket.send(JSON.stringify(payload));
	}

	private handleMessage(raw: string): void {
		const byteLength = new TextEncoder().encode(raw).byteLength;
		if (byteLength > MAX_INCOMING_WS_MESSAGE_BYTES) {
			safeWarn("Ignoring oversized websocket message", { byteLength });
			return;
		}

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

		if (parsed.event_type === "pong") {
			this.lastPongAt = Date.now();
			markHeartbeat();
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
