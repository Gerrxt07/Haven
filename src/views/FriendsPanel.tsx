import { RefreshCw, UserPlus, Users } from "lucide-solid";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { t, tf } from "../i18n";
import { friendsService } from "../lib/friends/service";
import { friendsStore } from "../lib/friends/store";

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
		<div class="flex flex-col gap-4 p-1 max-w-lg">
			{/* Header */}
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-semibold flex items-center gap-2">
					<Users size={20} />
					{t("friends", "title")}
				</h2>
				<button
					type="button"
					onClick={handleRefresh}
					disabled={friendsStore.loading}
					title={t("friends", "refresh")}
					class="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-secondary) transition-colors duration-200 disabled:opacity-50"
				>
					<RefreshCw
						size={16}
						class={friendsStore.loading ? "animate-spin" : ""}
					/>
				</button>
			</div>

			{/* Add Friend */}
			<div class="flex flex-col gap-1.5">
				<label
					for="add-friend-input"
					class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide"
				>
					{t("friends", "add_friend")}
				</label>
				<div class="flex gap-2">
					<input
						id="add-friend-input"
						ref={addInputRef}
						type="text"
						value={addUsername()}
						onInput={(e) => setAddUsername(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder={t("friends", "add_friend_placeholder")}
						disabled={addStatus() === "sending"}
						class="flex-1 px-3 py-2 rounded-lg bg-(--surface-secondary) border border-(--border-subtle) text-sm text-(--text-primary) placeholder-text-(--text-tertiary) focus:outline-none focus:border-(--accent-primary) transition-colors duration-200 disabled:opacity-60"
					/>
					<button
						type="button"
						onClick={() => void handleAddFriend()}
						disabled={addStatus() === "sending" || !addUsername().trim()}
						class="px-4 py-2 rounded-lg bg-(--accent-primary) hover:opacity-90 text-(--text-inverse) text-sm font-medium transition-opacity duration-200 disabled:opacity-50 flex items-center gap-1.5"
					>
						<UserPlus size={15} />
						{addStatus() === "sending"
							? t("friends", "add_friend_sending")
							: t("friends", "add_friend_btn")}
					</button>
				</div>
				<Show when={addStatus() === "success"}>
					<p class="text-xs text-(--accent-success)">
						{t("friends", "add_friend_success")}
					</p>
				</Show>
				<Show when={addStatus() === "error" && addError()}>
					<p class="text-xs text-(--accent-danger)">
						{addError() ?? t("friends", "add_friend_error")}
					</p>
				</Show>
			</div>

			{/* Incoming Requests */}
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
						{t("friends", "incoming_title")}
					</span>
					<Show when={friendsStore.incoming.length > 0}>
						<span class="px-1.5 py-0.5 rounded-full bg-(--accent-primary) text-(--text-inverse) text-xs font-bold leading-none">
							{friendsStore.incoming.length}
						</span>
					</Show>
				</div>

				<Show
					when={friendsStore.incoming.length > 0}
					fallback={
						<p class="text-sm text-(--text-secondary) pl-0.5">
							{t("friends", "no_incoming")}
						</p>
					}
				>
					<div class="flex flex-col gap-1.5">
						<For each={friendsStore.incoming}>
							{(request) => (
								<div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-(--surface-secondary)">
									<div class="flex flex-col min-w-0">
										<span class="text-sm font-medium text-(--text-primary) truncate">
											{request.from_display_name}
										</span>
										<span class="text-xs text-(--text-secondary) truncate">
											{tf("friends", "from_user", {
												username: request.from_username,
											})}
										</span>
									</div>
									<div class="flex items-center gap-1.5 shrink-0">
										<button
											type="button"
											onClick={() => void handleAccept(request.id)}
											disabled={
												acceptingId() === request.id || decliningId() !== null
											}
											class="px-2.5 py-1 rounded-md bg-(--accent-success) hover:opacity-90 text-(--text-inverse) text-xs font-medium transition-opacity duration-200 disabled:opacity-50"
										>
											{acceptingId() === request.id
												? t("friends", "accepting")
												: t("friends", "accept")}
										</button>
										<button
											type="button"
											onClick={() => void handleDecline(request.id)}
											disabled={
												decliningId() === request.id || acceptingId() !== null
											}
											class="px-2.5 py-1 rounded-md bg-(--surface-tertiary) hover:bg-(--accent-danger) hover:text-(--text-inverse) text-(--text-secondary) text-xs font-medium transition-colors duration-200 disabled:opacity-50"
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

			{/* Outgoing / Pending Requests */}
			<div class="flex flex-col gap-2">
				<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
					{t("friends", "outgoing_title")}
				</span>

				<Show
					when={friendsStore.outgoing.length > 0}
					fallback={
						<p class="text-sm text-(--text-secondary) pl-0.5">
							{t("friends", "no_outgoing")}
						</p>
					}
				>
					<div class="flex flex-col gap-1.5">
						<For each={friendsStore.outgoing}>
							{(request) => (
								<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-(--surface-secondary)">
									<div class="flex flex-col min-w-0">
										<span class="text-sm font-medium text-(--text-primary) truncate">
											{request.to_display_name}
										</span>
										<span class="text-xs text-(--text-secondary) truncate">
											{tf("friends", "to_user", {
												username: request.to_username,
											})}
										</span>
									</div>
									<span class="ml-auto shrink-0 text-xs text-(--text-tertiary) bg-(--surface-tertiary) px-2 py-0.5 rounded-full">
										{t("friends", "pending_status")}
									</span>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Friends List */}
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold text-(--text-secondary) uppercase tracking-wide">
						{t("friends", "friends_title")}
					</span>
					<Show when={friendsStore.friends.length > 0}>
						<span class="text-xs text-(--text-tertiary)">
							({friendsStore.friends.length})
						</span>
					</Show>
				</div>

				<Show
					when={friendsStore.friends.length > 0}
					fallback={
						<p class="text-sm text-(--text-secondary) pl-0.5">
							{t("friends", "no_friends")}
						</p>
					}
				>
					<div class="flex flex-col gap-1.5">
						<For each={friendsStore.friends}>
							{(friend) => (
								<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-(--surface-secondary)">
									<div class="w-8 h-8 rounded-full bg-(--accent-primary) flex items-center justify-center text-(--text-inverse) text-sm font-bold shrink-0">
										{friend.friend_display_name.charAt(0).toUpperCase()}
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-sm font-medium text-(--text-primary) truncate">
											{friend.friend_display_name}
										</span>
										<span class="text-xs text-(--text-secondary) truncate">
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
	);
}
