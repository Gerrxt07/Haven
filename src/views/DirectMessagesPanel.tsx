import { MessageCircle, SendHorizontal, UserPlus, Users } from "lucide-solid";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onMount,
	Show,
} from "solid-js";
import { t } from "../i18n";
import { authSession } from "../lib/auth/session";
import { dmService } from "../lib/dm/service";
import { dmStore } from "../lib/dm/store";
import { friendsService } from "../lib/friends/service";
import { friendsStore } from "../lib/friends/store";

function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function formatDateTime(iso: string | null | undefined): string {
	if (!iso) {
		return "";
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

export default function DirectMessagesPanel() {
	const [authState, setAuthState] = createSignal(authSession.snapshot());
	const [composerText, setComposerText] = createSignal("");
	const [sending, setSending] = createSignal(false);
	const [actionError, setActionError] = createSignal<string | null>(null);
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	let messagesContainer: HTMLDivElement | undefined;

	const activeThreadId = createMemo(() => dmStore.activeThreadId);
	const activeThread = createMemo(() => {
		const threadId = activeThreadId();
		if (threadId === null) {
			return null;
		}
		return dmStore.threads.find((thread) => thread.id === threadId) ?? null;
	});
	const activeMessages = createMemo(() => {
		const threadId = activeThreadId();
		if (threadId === null) {
			return [];
		}
		return dmStore.messagesByThread[String(threadId)]?.items ?? [];
	});

	onMount(() => {
		const unsub = authSession.onChange(setAuthState);
		void friendsService.init();
		void dmService.init().then(() => {
			if (dmStore.activeThreadId === null && dmStore.threads.length > 0) {
				void dmService.openThread(dmStore.threads[0].id);
			}
		});
		return () => unsub();
	});

	createEffect(() => {
		activeMessages().length;
		queueMicrotask(() => {
			if (!messagesContainer) {
				return;
			}
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		});
	});

	const openThread = async (threadId: number): Promise<void> => {
		setActionError(null);
		try {
			await dmService.openThread(threadId);
		} catch (error) {
			setActionError(
				error instanceof Error
					? error.message
					: t("home", "messages_load_failed"),
			);
		}
	};

	const startChatWithFriend = async (peerUserId: number): Promise<void> => {
		setActionError(null);
		try {
			await dmService.startThreadWithPeer(peerUserId);
		} catch (error) {
			setActionError(
				error instanceof Error
					? error.message
					: t("home", "messages_load_failed"),
			);
		}
	};

	const sendMessage = async (): Promise<void> => {
		if (sending()) {
			return;
		}
		const threadId = activeThreadId();
		const authorUserId = authState().currentUser?.id;
		if (threadId === null || !authorUserId) {
			return;
		}

		const text = composerText().trim();
		if (!text) {
			return;
		}

		setSending(true);
		setActionError(null);
		setComposerText("");
		try {
			await dmService.sendMessage(threadId, authorUserId, text);
		} catch (error) {
			setActionError(
				error instanceof Error
					? error.message
					: t("home", "messages_send_failed"),
			);
			setComposerText(text);
		} finally {
			setSending(false);
		}
	};

	const loadOlder = async (): Promise<void> => {
		const threadId = activeThreadId();
		if (threadId === null) {
			return;
		}
		setActionError(null);
		try {
			await dmService.loadNextMessages(threadId, 50);
		} catch (error) {
			setActionError(
				error instanceof Error
					? error.message
					: t("home", "messages_load_failed"),
			);
		}
	};

	return (
		<div class="grid h-full min-h-0 w-full grid-cols-1 overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-secondary) lg:grid-cols-[340px_minmax(0,1fr)]">
			<aside class="min-h-0 border-b border-(--border-subtle) lg:border-b-0 lg:border-r">
				<div class="border-b border-(--border-subtle) px-4 py-3">
					<h2 class="flex items-center gap-2 text-base font-semibold text-(--text-primary)">
						<MessageCircle size={18} />
						{t("home", "messages_title")}
					</h2>
					<p class="mt-1 text-xs text-(--text-secondary)">
						{t("home", "messages_hint")}
					</p>
				</div>

				<div class="border-b border-(--border-subtle) px-3 py-2.5">
					<p class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
						<Users size={13} />
						{t("home", "messages_friends")}
					</p>
					<div class="max-h-32 overflow-y-auto space-y-1 pr-1">
						<Show
							when={friendsStore.friends.length > 0}
							fallback={
								<p class="rounded-md bg-(--surface-primary) px-2.5 py-2 text-xs text-(--text-secondary)">
									{t("home", "messages_no_friends")}
								</p>
							}
						>
							<For each={friendsStore.friends}>
								{(friend) => (
									<button
										type="button"
										onClick={() =>
											void startChatWithFriend(friend.friend_user_id)
										}
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-(--surface-primary)"
									>
										<img
											src={friend.friend_avatar_url ?? fallbackProfileImage}
											alt={friend.friend_display_name}
											class="h-7 w-7 rounded-lg object-cover"
											onError={(event) => {
												event.currentTarget.src = fallbackProfileImage;
											}}
										/>
										<div class="min-w-0">
											<p class="truncate text-sm text-(--text-primary)">
												{friend.friend_display_name}
											</p>
											<p class="truncate text-[11px] text-(--text-secondary)">
												@{friend.friend_username}
											</p>
										</div>
										<UserPlus
											size={13}
											class="ml-auto text-(--text-tertiary)"
										/>
									</button>
								)}
							</For>
						</Show>
					</div>
				</div>

				<div class="min-h-0 px-3 py-2.5">
					<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
						{t("home", "messages_conversations")}
					</p>
					<div class="max-h-[calc(100vh-360px)] overflow-y-auto space-y-1 pr-1">
						<Show
							when={dmStore.threads.length > 0}
							fallback={
								<p class="rounded-md bg-(--surface-primary) px-2.5 py-2 text-xs text-(--text-secondary)">
									{t("home", "messages_empty")}
								</p>
							}
						>
							<For each={dmStore.threads}>
								{(thread) => (
									<button
										type="button"
										onClick={() => void openThread(thread.id)}
										class={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${
											activeThreadId() === thread.id
												? "border-(--accent-primary) bg-(--surface-primary)"
												: "border-transparent hover:bg-(--surface-primary)"
										}`}
									>
										<div class="flex items-center gap-2">
											<img
												src={thread.peer_avatar_url ?? fallbackProfileImage}
												alt={thread.peer_display_name}
												class="h-8 w-8 rounded-lg object-cover"
												onError={(event) => {
													event.currentTarget.src = fallbackProfileImage;
												}}
											/>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium text-(--text-primary)">
													{thread.peer_display_name}
												</p>
												<p class="truncate text-[11px] text-(--text-secondary)">
													{thread.last_message_preview ??
														t("home", "messages_no_history")}
												</p>
											</div>
											<span class="text-[10px] text-(--text-tertiary)">
												{formatDateTime(thread.last_message_at)}
											</span>
										</div>
									</button>
								)}
							</For>
						</Show>
					</div>
				</div>
			</aside>

			<section class="min-h-0 flex flex-col">
				<div class="border-b border-(--border-subtle) px-4 py-3">
					<Show
						when={activeThread()}
						fallback={
							<div>
								<p class="text-sm font-semibold text-(--text-primary)">
									{t("home", "messages_select_thread")}
								</p>
								<p class="text-xs text-(--text-secondary)">
									{t("home", "messages_select_thread_hint")}
								</p>
							</div>
						}
					>
						{(thread) => (
							<div class="flex items-center gap-3">
								<img
									src={thread().peer_avatar_url ?? fallbackProfileImage}
									alt={thread().peer_display_name}
									class="h-9 w-9 rounded-xl object-cover"
									onError={(event) => {
										event.currentTarget.src = fallbackProfileImage;
									}}
								/>
								<div>
									<p class="text-sm font-semibold text-(--text-primary)">
										{thread().peer_display_name}
									</p>
									<p class="text-xs text-(--text-secondary)">
										@{thread().peer_username}
									</p>
								</div>
							</div>
						)}
					</Show>
				</div>

				<div
					ref={messagesContainer}
					class="min-h-0 flex-1 overflow-y-auto px-4 py-3"
				>
					<Show
						when={activeThreadId() !== null}
						fallback={
							<div class="flex h-full items-center justify-center text-sm text-(--text-secondary)">
								{t("home", "messages_empty_state")}
							</div>
						}
					>
						<div class="flex min-h-full flex-col gap-2">
							<div class="flex justify-center">
								<button
									type="button"
									onClick={() => void loadOlder()}
									disabled={
										activeThreadId() === null ||
										dmStore.messagesByThread[String(activeThreadId() ?? 0)]
											?.loading
									}
									class="rounded-md border border-(--border-subtle) bg-(--surface-primary) px-2 py-1 text-[11px] text-(--text-secondary) transition-colors duration-150 hover:text-(--text-primary) disabled:opacity-50"
								>
									{t("home", "messages_load_older")}
								</button>
							</div>
							<Show
								when={activeMessages().length > 0}
								fallback={
									<p class="mx-auto my-auto rounded-xl border border-dashed border-(--border-subtle) px-4 py-3 text-sm text-(--text-secondary)">
										{t("home", "messages_no_history")}
									</p>
								}
							>
								<For each={activeMessages()}>
									{(message) => {
										const isOwn =
											message.author_user_id === authState().currentUser?.id;
										return (
											<div
												class={`flex ${isOwn ? "justify-end" : "justify-start"}`}
											>
												<div
													class={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${
														isOwn
															? "bg-(--accent-primary) text-(--text-inverse)"
															: "bg-(--surface-primary) text-(--text-primary)"
													}`}
												>
													<p class="whitespace-pre-wrap break-words text-sm">
														{message.is_encrypted
															? t("home", "messages_encrypted_placeholder")
															: message.content}
													</p>
													<p
														class={`mt-1 text-[10px] ${
															isOwn ? "text-white/75" : "text-(--text-tertiary)"
														}`}
													>
														{formatTime(message.created_at)}
													</p>
												</div>
											</div>
										);
									}}
								</For>
							</Show>
						</div>
					</Show>
				</div>

				<div class="border-t border-(--border-subtle) px-4 py-3">
					<Show when={actionError()}>
						<p class="mb-2 text-xs text-red-500">{actionError()}</p>
					</Show>
					<div class="flex items-center gap-2">
						<input
							type="text"
							value={composerText()}
							onInput={(event) => setComposerText(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void sendMessage();
								}
							}}
							disabled={activeThreadId() === null || sending()}
							placeholder={t("home", "messages_input_placeholder")}
							class="h-10 flex-1 rounded-xl border border-(--border-subtle) bg-(--surface-primary) px-3 text-sm text-(--text-primary) outline-none transition-colors duration-150 placeholder:text-(--text-tertiary) focus:border-(--accent-primary) disabled:opacity-60"
						/>
						<button
							type="button"
							onClick={() => void sendMessage()}
							disabled={
								activeThreadId() === null || sending() || !composerText().trim()
							}
							class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-(--accent-primary) text-(--text-inverse) transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
						>
							<SendHorizontal size={15} />
						</button>
					</div>
				</div>
			</section>
		</div>
	);
}
