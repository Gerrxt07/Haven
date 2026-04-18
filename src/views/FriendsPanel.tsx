import {
	CheckCheck,
	Clock3,
	Inbox,
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

export default function FriendsPanel() {
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
		<div class="flex w-full flex-col gap-4 p-1.5 lg:p-2">
			<div class="relative overflow-hidden rounded-3xl border border-(--border-subtle) bg-(--surface-secondary) shadow-[var(--shadow-card)]">
				<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(88,101,242,0.35),transparent_55%)]" />
				<div class="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_70%)]" />
				<div class="relative flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
					<div class="min-w-0">
						<h2 class="flex items-center gap-2 text-xl font-semibold text-(--text-primary)">
							<Users size={20} />
							{t("friends", "title")}
						</h2>
						<p class="mt-1 text-sm text-(--text-secondary)">
							{friendsStore.loading
								? t("friends", "loading")
								: t("friends", "friends_title")}
						</p>
					</div>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={friendsStore.loading}
						title={t("friends", "refresh")}
						class="inline-flex items-center gap-1.5 rounded-xl border border-(--border-subtle) bg-(--surface-primary) px-3 py-2 text-xs font-semibold text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary) hover:bg-(--surface-tertiary) disabled:opacity-50"
					>
						<RefreshCw
							size={14}
							class={friendsStore.loading ? "animate-spin" : ""}
						/>
						{t("friends", "refresh")}
					</button>
				</div>

				<div class="relative grid grid-cols-3 gap-2 px-4 pb-4">
					<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-primary) p-3">
						<div class="flex items-center justify-between text-(--text-secondary)">
							<span class="text-xs font-semibold uppercase tracking-wide">
								{t("friends", "friends_title")}
							</span>
							<Users size={14} />
						</div>
						<p class="mt-2 text-xl font-semibold text-(--text-primary)">
							{friendsStore.friends.length}
						</p>
					</div>
					<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-primary) p-3">
						<div class="flex items-center justify-between text-(--text-secondary)">
							<span class="text-xs font-semibold uppercase tracking-wide">
								{t("friends", "incoming_title")}
							</span>
							<Inbox size={14} />
						</div>
						<p class="mt-2 text-xl font-semibold text-(--text-primary)">
							{friendsStore.incoming.length}
						</p>
					</div>
					<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-primary) p-3">
						<div class="flex items-center justify-between text-(--text-secondary)">
							<span class="text-xs font-semibold uppercase tracking-wide">
								{t("friends", "outgoing_title")}
							</span>
							<Clock3 size={14} />
						</div>
						<p class="mt-2 text-xl font-semibold text-(--text-primary)">
							{friendsStore.outgoing.length}
						</p>
					</div>
				</div>

				<Show when={friendsStore.error}>
					<p class="relative border-t border-(--border-subtle) px-4 py-2 text-xs text-red-500">
						{friendsStore.error}
					</p>
				</Show>
			</div>

			<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-secondary) p-4 shadow-[var(--shadow-card)]">
				<label
					for="add-friend-input"
					class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide"
				>
					{t("friends", "add_friend")}
				</label>
				<div class="mt-2 flex flex-col gap-2 sm:flex-row">
					<div class="relative flex-1">
						<UserPlus
							size={15}
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
							class="h-11 w-full rounded-xl border border-(--border-subtle) bg-(--surface-primary) pl-9 pr-3 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) outline-none transition-colors duration-200 focus:border-(--accent-primary) disabled:opacity-60"
						/>
					</div>
					<button
						type="button"
						onClick={() => void handleAddFriend()}
						disabled={addStatus() === "sending" || !addUsername().trim()}
						class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--accent-primary) px-4 text-sm font-semibold text-(--text-inverse) transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
					>
						<SendHorizontal size={15} />
						{addStatus() === "sending"
							? t("friends", "add_friend_sending")
							: t("friends", "add_friend_btn")}
					</button>
				</div>
				<Show when={addStatus() === "success"}>
					<p class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-(--surface-primary) px-2.5 py-1 text-xs text-(--accent-success)">
						<CheckCheck size={14} />
						{t("friends", "add_friend_success")}
					</p>
				</Show>
				<Show when={addStatus() === "error" && addError()}>
					<p class="mt-2 text-xs text-red-500">
						{addError() ?? t("friends", "add_friend_error")}
					</p>
				</Show>
			</div>

			<div class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div class="flex min-h-0 flex-col gap-4">
					<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-secondary) p-3.5 shadow-[var(--shadow-card)]">
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
								{t("friends", "incoming_title")}
							</span>
							<Show when={friendsStore.incoming.length > 0}>
								<span class="rounded-full bg-(--accent-primary) px-2 py-0.5 text-[11px] font-bold leading-none text-(--text-inverse)">
									{friendsStore.incoming.length}
								</span>
							</Show>
						</div>

						<Show
							when={friendsStore.incoming.length > 0}
							fallback={
								<p class="rounded-xl border border-dashed border-(--border-subtle) bg-(--surface-primary) px-3 py-5 text-center text-sm text-(--text-secondary)">
									{t("friends", "no_incoming")}
								</p>
							}
						>
							<div class="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
								<For each={friendsStore.incoming}>
									{(request) => (
										<div class="group rounded-xl border border-(--border-subtle) bg-(--surface-primary) px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:border-(--border-strong)">
											<div class="flex items-center gap-3">
												<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--surface-tertiary) text-xs font-semibold text-(--text-secondary)">
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
											</div>
											<div class="mt-2.5 flex items-center justify-end gap-1.5">
												<button
													type="button"
													onClick={() => void handleAccept(request.id)}
													disabled={
														acceptingId() === request.id ||
														decliningId() !== null
													}
													class="rounded-lg bg-(--accent-success) px-2.5 py-1 text-xs font-semibold text-(--text-inverse) transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
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
													class="rounded-lg border border-(--border-subtle) bg-(--surface-secondary) px-2.5 py-1 text-xs font-semibold text-(--text-secondary) transition-colors duration-200 hover:border-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50"
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
					</div>

					<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-secondary) p-3.5 shadow-[var(--shadow-card)]">
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
								{t("friends", "outgoing_title")}
							</span>
						</div>

						<Show
							when={friendsStore.outgoing.length > 0}
							fallback={
								<p class="rounded-xl border border-dashed border-(--border-subtle) bg-(--surface-primary) px-3 py-5 text-center text-sm text-(--text-secondary)">
									{t("friends", "no_outgoing")}
								</p>
							}
						>
							<div class="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
								<For each={friendsStore.outgoing}>
									{(request) => (
										<div class="flex items-center gap-3 rounded-xl border border-(--border-subtle) bg-(--surface-primary) px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:border-(--border-strong)">
											<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--surface-tertiary) text-xs font-semibold text-(--text-secondary)">
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
											<span class="shrink-0 rounded-full border border-(--border-subtle) bg-(--surface-secondary) px-2 py-0.5 text-[11px] text-(--text-tertiary)">
												{t("friends", "pending_status")}
											</span>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</div>

				<div class="rounded-2xl border border-(--border-subtle) bg-(--surface-secondary) p-3.5 shadow-[var(--shadow-card)]">
					<div class="mb-2 flex items-center gap-2">
						<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
							{t("friends", "friends_title")}
						</span>
						<Show when={friendsStore.friends.length > 0}>
							<span class="rounded-full border border-(--border-subtle) bg-(--surface-primary) px-2 py-0.5 text-[11px] text-(--text-tertiary)">
								{friendsStore.friends.length}
							</span>
						</Show>
					</div>

					<Show
						when={friendsStore.friends.length > 0}
						fallback={
							<p class="rounded-xl border border-dashed border-(--border-subtle) bg-(--surface-primary) px-3 py-6 text-center text-sm text-(--text-secondary)">
								{t("friends", "no_friends")}
							</p>
						}
					>
						<div class="grid max-h-[29rem] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
							<For each={friendsStore.friends}>
								{(friend) => (
									<div class="group flex items-center gap-3 rounded-xl border border-(--border-subtle) bg-(--surface-primary) px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:border-(--border-strong)">
										<FriendAvatar
											userId={friend.friend_user_id}
											displayName={friend.friend_display_name}
											avatarUrl={friend.friend_avatar_url}
										/>
										<div class="min-w-0">
											<span class="block truncate text-sm font-semibold text-(--text-primary)">
												{friend.friend_display_name}
											</span>
											<span class="block truncate text-xs text-(--text-secondary)">
												@{friend.friend_username}
											</span>
										</div>
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
