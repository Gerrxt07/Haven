import {
	CheckCheck,
	Clock3,
	Inbox,
	MessageCircle,
	RefreshCw,
	SendHorizontal,
	UserPlus,
	Users,
} from "lucide-solid";
import type { JSX } from "solid-js";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { t, tf } from "../i18n";
import type { AuthUserResponse } from "../lib/api";
import { authSession } from "../lib/auth/session";
import { resolveProfileImageForUser } from "../lib/cache/profile-images";
import { friendsService } from "../lib/friends/service";
import { friendsStore } from "../lib/friends/store";

function FriendAvatar(props: {
	userId: number;
	displayName: string;
	avatarUrl?: string | null;
}): JSX.Element {
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	const [avatarSrc, setAvatarSrc] = createSignal(fallbackProfileImage);
	let resolveToken = 0;

	createEffect(() => {
		const token = ++resolveToken;
		const friendUser = {
			id: props.userId,
			avatar_url: props.avatarUrl,
		} as unknown as AuthUserResponse;

		void resolveProfileImageForUser(
			friendUser,
			fallbackProfileImage,
			authSession.accessToken,
		).then((src) => {
			if (token !== resolveToken) {
				return;
			}
			setAvatarSrc(src);
		});
	});

	return (
		<img
			src={avatarSrc()}
			alt={`${props.displayName} avatar`}
			class="h-10 w-10 rounded-2xl object-cover shrink-0 border border-(--border-subtle) shadow-sm"
			loading="lazy"
			onError={(e) => {
				e.currentTarget.src = fallbackProfileImage;
			}}
		/>
	);
}

function getInitial(value: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) {
		return "#";
	}

	return normalized.slice(0, 1).toUpperCase();
}

export default function FriendsPanel(props: {
	onOpenDirectMessage?: (peerUserId: number) => void;
}) {
	const [addUsername, setAddUsername] = createSignal("");
	const [addStatus, setAddStatus] = createSignal<
		"idle" | "sending" | "success" | "error"
	>("idle");
	const [addError, setAddError] = createSignal<string | null>(null);
	const [acceptingId, setAcceptingId] = createSignal<number | null>(null);
	const [decliningId, setDecliningId] = createSignal<number | null>(null);
	let addInputRef: HTMLInputElement | undefined;
	let statusResetTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	onMount(() => {
		void friendsService.init();
	});

	onCleanup(() => {
		if (statusResetTimer !== null) {
			globalThis.clearTimeout(statusResetTimer);
		}
	});

	createEffect(() => {
		if (addStatus() === "success" || addStatus() === "error") {
			if (statusResetTimer !== null) {
				globalThis.clearTimeout(statusResetTimer);
			}
			statusResetTimer = globalThis.setTimeout(() => {
				setAddStatus("idle");
				setAddError(null);
				statusResetTimer = null;
			}, 3500);
		}
	});

	const handleAddFriend = async (): Promise<void> => {
		const username = addUsername().trim();
		if (!username || addStatus() === "sending") return;

		setAddStatus("sending");
		setAddError(null);

		const result = await friendsService.sendRequest(username);

		if (result.ok) {
			setAddStatus("success");
			setAddUsername("");
			addInputRef?.focus();
		} else {
			setAddStatus("error");
			setAddError(result.error ?? t("friends", "add_friend_error"));
		}
	};

	const handleKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "Enter") {
			void handleAddFriend();
		}
	};

	const handleAccept = async (requestId: number): Promise<void> => {
		if (acceptingId() !== null) return;
		setAcceptingId(requestId);
		await friendsService.acceptRequest(requestId);
		setAcceptingId(null);
	};

	const handleDecline = async (requestId: number): Promise<void> => {
		if (decliningId() !== null) return;
		setDecliningId(requestId);
		await friendsService.declineRequest(requestId);
		setDecliningId(null);
	};

	const handleRefresh = (): void => {
		void friendsService.refresh();
	};

	return (
		<div class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-secondary)">
			<div class="flex items-center gap-2 border-b border-(--border-subtle) px-3 py-2.5 sm:px-4">
				<h2 class="mr-2 flex items-center gap-2 text-base font-semibold text-(--text-primary)">
					<Users size={18} />
					{t("friends", "title")}
				</h2>
				<span class="inline-flex items-center gap-1 rounded-md bg-(--surface-primary) px-2 py-1 text-[11px] font-semibold text-(--text-secondary)">
					<Users size={12} />
					{friendsStore.friends.length}
				</span>
				<span
					class={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
						friendsStore.incoming.length > 0
							? "bg-(--accent-primary) text-(--text-inverse)"
							: "bg-(--surface-primary) text-(--text-secondary)"
					}`}
				>
					<Inbox size={12} />
					{friendsStore.incoming.length}
				</span>
				<span class="inline-flex items-center gap-1 rounded-md bg-(--surface-primary) px-2 py-1 text-[11px] font-semibold text-(--text-secondary)">
					<Clock3 size={12} />
					{friendsStore.outgoing.length}
				</span>
				<button
					type="button"
					onClick={handleRefresh}
					disabled={friendsStore.loading}
					title={t("friends", "refresh")}
					class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-(--text-secondary) transition-colors duration-200 hover:bg-(--surface-primary) hover:text-(--text-primary) disabled:opacity-50"
				>
					<RefreshCw
						size={15}
						class={friendsStore.loading ? "animate-spin" : ""}
					/>
				</button>
			</div>

			<div class="border-b border-(--border-subtle) px-3 py-3 sm:px-4">
				<label
					for="add-friend-input"
					class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)"
				>
					{t("friends", "add_friend")}
				</label>
				<div class="flex flex-col gap-2 sm:flex-row">
					<div class="relative flex-1">
						<UserPlus
							size={14}
							class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary)"
						/>
						<input
							id="add-friend-input"
							ref={addInputRef}
							type="text"
							value={addUsername()}
							onInput={(e) => setAddUsername(e.currentTarget.value)}
							onKeyDown={handleKeyDown}
							placeholder={t("friends", "add_friend_placeholder")}
							disabled={addStatus() === "sending"}
							class="h-10 w-full rounded-md border border-(--border-subtle) bg-(--surface-primary) pl-9 pr-3 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) outline-none transition-colors duration-150 focus:border-(--accent-primary) disabled:opacity-60"
						/>
					</div>
					<button
						type="button"
						onClick={() => void handleAddFriend()}
						disabled={addStatus() === "sending" || !addUsername().trim()}
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-(--accent-primary) px-3 text-sm font-semibold text-(--text-inverse) transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
					>
						<SendHorizontal size={14} />
						{addStatus() === "sending"
							? t("friends", "add_friend_sending")
							: t("friends", "add_friend_btn")}
					</button>
				</div>
				<Show when={addStatus() === "success"}>
					<p class="mt-2 inline-flex items-center gap-1.5 text-xs text-(--accent-success)">
						<CheckCheck size={13} />
						{t("friends", "add_friend_success")}
					</p>
				</Show>
				<Show when={addStatus() === "error" && addError()}>
					<p class="mt-2 text-xs text-red-500">
						{addError() ?? t("friends", "add_friend_error")}
					</p>
				</Show>
				<Show when={friendsStore.error}>
					<p class="mt-1.5 text-xs text-red-500">{friendsStore.error}</p>
				</Show>
			</div>

			<div class="grid min-h-0 flex-1 md:grid-cols-[340px_minmax(0,1fr)]">
				<div class="min-h-0 border-b border-(--border-subtle) md:border-b-0 md:border-r">
					<div class="flex h-full min-h-0 flex-col">
						<div class="border-b border-(--border-subtle) px-3 py-2.5 sm:px-4">
							<div class="flex items-center gap-2">
								<span class="text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
									{t("friends", "incoming_title")}
								</span>
								<Show when={friendsStore.incoming.length > 0}>
									<span
										class={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
											friendsStore.incoming.length > 0
												? "bg-(--accent-primary) text-(--text-inverse) animate-pulse"
												: "bg-(--surface-primary) text-(--text-secondary)"
										}`}
									>
										{friendsStore.incoming.length}
									</span>
								</Show>
							</div>
						</div>
						<Show
							when={friendsStore.incoming.length > 0}
							fallback={
								<p class="px-4 py-3 text-sm text-(--text-secondary)">
									{t("friends", "no_incoming")}
								</p>
							}
						>
							<div class="max-h-56 overflow-y-auto px-2 py-1.5">
								<For each={friendsStore.incoming}>
									{(request) => (
										<div class="group flex items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-(--surface-primary)">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--surface-tertiary) text-xs font-semibold text-(--text-secondary)">
												{getInitial(request.from_display_name)}
											</div>
											<div class="min-w-0 flex-1">
												<span class="block truncate text-sm font-medium text-(--text-primary)">
													{request.from_display_name}
												</span>
												<span class="block truncate text-xs text-(--text-secondary)">
													{tf("friends", "from_user", {
														username: request.from_username,
													})}
												</span>
											</div>
											<div class="flex items-center gap-1">
												<button
													type="button"
													onClick={() => void handleAccept(request.id)}
													disabled={
														acceptingId() === request.id ||
														decliningId() !== null
													}
													class="rounded bg-(--accent-success) px-2 py-1 text-[11px] font-semibold text-(--text-inverse) transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
												>
													{acceptingId() === request.id
														? t("friends", "accepting")
														: t("friends", "accept")}
												</button>
												<button
													type="button"
													onClick={() => void handleDecline(request.id)}
													disabled={
														decliningId() === request.id ||
														acceptingId() !== null
													}
													class="rounded bg-(--surface-tertiary) px-2 py-1 text-[11px] font-semibold text-(--text-secondary) transition-colors duration-150 hover:bg-red-500 hover:text-white disabled:opacity-50"
												>
													{decliningId() === request.id
														? t("friends", "declining")
														: t("friends", "decline")}
												</button>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>

						<div class="border-y border-(--border-subtle) px-3 py-2.5 sm:px-4">
							<span class="text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
								{t("friends", "outgoing_title")}
							</span>
						</div>
						<Show
							when={friendsStore.outgoing.length > 0}
							fallback={
								<p class="px-4 py-3 text-sm text-(--text-secondary)">
									{t("friends", "no_outgoing")}
								</p>
							}
						>
							<div class="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
								<For each={friendsStore.outgoing}>
									{(request) => (
										<div class="group flex items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-(--surface-primary)">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--surface-tertiary) text-xs font-semibold text-(--text-secondary)">
												{getInitial(request.to_display_name)}
											</div>
											<div class="min-w-0 flex-1">
												<span class="block truncate text-sm font-medium text-(--text-primary)">
													{request.to_display_name}
												</span>
												<span class="block truncate text-xs text-(--text-secondary)">
													{tf("friends", "to_user", {
														username: request.to_username,
													})}
												</span>
											</div>
											<span class="rounded bg-(--surface-tertiary) px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
												{t("friends", "pending_status")}
											</span>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</div>

				<div class="min-h-0 flex flex-col">
					<div class="border-b border-(--border-subtle) px-3 py-2.5 sm:px-4">
						<span class="text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
							{t("friends", "friends_title")} ({friendsStore.friends.length})
						</span>
					</div>
					<Show
						when={friendsStore.friends.length > 0}
						fallback={
							<p class="px-4 py-4 text-sm text-(--text-secondary)">
								{t("friends", "no_friends")}
							</p>
						}
					>
						<div class="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
							<For each={friendsStore.friends}>
								{(friend, index) => (
									<div class="group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-150 hover:bg-(--surface-primary)">
										<div class="relative shrink-0">
											<FriendAvatar
												userId={friend.friend_user_id}
												displayName={friend.friend_display_name}
												avatarUrl={friend.friend_avatar_url}
											/>
											<span
												class={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-(--surface-secondary) ${
													index() % 3 === 0
														? "bg-(--accent-success) animate-pulse"
														: "bg-(--text-tertiary)"
												}`}
											/>
										</div>
										<div class="min-w-0">
											<span class="block truncate text-sm font-medium text-(--text-primary)">
												{friend.friend_display_name}
											</span>
											<span class="block truncate text-xs text-(--text-secondary)">
												@{friend.friend_username}
											</span>
										</div>
										<button
											type="button"
											onClick={() =>
												props.onOpenDirectMessage?.(friend.friend_user_id)
											}
											class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-(--text-secondary) transition-colors duration-150 hover:bg-(--surface-tertiary) hover:text-(--text-primary)"
											title={t("home", "messages_title")}
										>
											<MessageCircle size={15} />
										</button>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
}
