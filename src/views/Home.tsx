import { Compass, Home as HomeIcon, MessageCircle, Users } from "lucide-solid";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../components/ui/tooltip";
import { t } from "../i18n";
import { authSession } from "../lib/auth/session";
import { resolveProfileImageForUser } from "../lib/cache/profile-images";
import { friendsStore } from "../lib/friends/store";
import {
	writeDetailedErrorLog,
	writeDetailedLog,
} from "../lib/logging/detailed";
import FriendsPanel from "./FriendsPanel";

export default function Home() {
	type SidebarArea = "home" | "messages" | "explorer" | "friends";

	const [authState, setAuthState] = createSignal(authSession.snapshot());
	const [isUploadingImage, setIsUploadingImage] = createSignal(false);
	const [activeArea, setActiveArea] = createSignal<SidebarArea>("home");
	const [hasNewMessages, setHasNewMessages] = createSignal(false);
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	const [profileImageSrc, setProfileImageSrc] =
		createSignal(fallbackProfileImage);
	let imageInputRef: HTMLInputElement | undefined;

	const user = () => authState().currentUser;
	const isAreaActive = (area: SidebarArea) => activeArea() === area;
	let imageResolveToken = 0;

	onMount(() => {
		const unsub = authSession.onChange(setAuthState);
		onCleanup(() => unsub());
	});

	createEffect(() => {
		const currentUser = user();
		const accessToken = authState().accessToken;
		const token = ++imageResolveToken;

		void resolveProfileImageForUser(
			currentUser,
			fallbackProfileImage,
			accessToken,
		).then((imageSrc) => {
			if (token !== imageResolveToken) {
				return;
			}
			setProfileImageSrc(imageSrc);
		});
	});

	const handleSelectProfileImage = (): void => {
		if (!imageInputRef || isUploadingImage()) {
			return;
		}

		imageInputRef.value = "";
		imageInputRef.click();
	};

	const openArea = (area: SidebarArea): void => {
		setActiveArea(area);
		if (area === "messages") {
			setHasNewMessages(false);
		}
	};

	const simulateIncomingMessage = (): void => {
		if (!isAreaActive("messages")) {
			setHasNewMessages(true);
		}
	};

	const handleProfileImagePicked = async (event: Event): Promise<void> => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || isUploadingImage()) {
			return;
		}

		try {
			setIsUploadingImage(true);
			await writeDetailedLog("avatar-upload", "ui-file-picked", {
				userId: user()?.id ?? null,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
			});
			await authSession.uploadProfilePicture(file);
			await writeDetailedLog("avatar-upload", "ui-upload-finished", {
				userId: user()?.id ?? null,
				fileName: file.name,
			});
		} catch (error) {
			console.warn("Profile picture upload failed", error);
			await writeDetailedErrorLog("avatar-upload", "ui-upload-failed", error, {
				userId: user()?.id ?? null,
				fileName: file?.name ?? null,
			});
		} finally {
			setIsUploadingImage(false);
		}
	};

	return (
		<div class="flex h-full w-full bg-(--surface-primary) text-(--text-primary)">
			{/* Workspace Sidebar */}
			<nav class="w-14 sm:w-16 shrink-0 bg-(--surface-secondary) flex flex-col items-center py-3 overflow-y-auto hidden-scrollbar transition-all duration-200">
				{/* Top: Home */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Home"
						onClick={() => openArea("home")}
						class={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-3xl transition-all duration-300 ease-out flex items-center justify-center shrink-0 mb-2 group ${
							isAreaActive("home")
								? "rounded-2xl bg-(--accent-primary) text-(--text-inverse) shadow-[0_0_0_2px_rgba(88,101,242,0.28),0_10px_24px_rgba(88,101,242,0.25)]"
								: "bg-transparent hover:bg-(--accent-primary) text-(--text-secondary) hover:text-(--text-inverse)"
						}`}
					>
						<div
							class={`absolute -left-2 h-7 w-1.5 rounded-full transition-all duration-300 ${
								isAreaActive("home")
									? "opacity-100"
									: "opacity-0 group-hover:opacity-70"
							}`}
							style={{ "background-color": "var(--accent-primary)" }}
						/>
						<HomeIcon size={22} stroke-width={2} />
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_home")}</TooltipContent>
				</Tooltip>

				{/* Top: Private Messages */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Private Messages"
						onClick={() => openArea("messages")}
						class={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-3xl transition-all duration-300 ease-out flex items-center justify-center shrink-0 mb-2 group ${
							isAreaActive("messages")
								? "rounded-2xl bg-[#f97316] text-(--text-inverse) shadow-[0_0_0_2px_rgba(249,115,22,0.3),0_10px_24px_rgba(249,115,22,0.26)]"
								: "bg-transparent hover:bg-[#f97316] text-[#fb923c] hover:text-(--text-inverse)"
						}`}
					>
						<div
							class={`absolute -left-2 h-7 w-1.5 rounded-full transition-all duration-300 ${
								isAreaActive("messages")
									? "opacity-100"
									: "opacity-0 group-hover:opacity-70"
							}`}
							style={{ "background-color": "#f97316" }}
						/>
						<div
							class={`rounded-full transition-all duration-500 ${
								hasNewMessages() && !isAreaActive("messages")
									? "animate-pulse shadow-[0_0_0_3px_rgba(251,146,60,0.35),0_0_24px_rgba(249,115,22,0.75)]"
									: ""
							}`}
						>
							<MessageCircle size={22} stroke-width={2} />
						</div>
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_messages")}</TooltipContent>
				</Tooltip>

				{/* Top: Explorer */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Explorer"
						onClick={() => openArea("explorer")}
						class={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-3xl transition-all duration-300 ease-out flex items-center justify-center shrink-0 mb-2 group ${
							isAreaActive("explorer")
								? "rounded-2xl bg-(--accent-success) text-(--text-inverse) shadow-[0_0_0_2px_rgba(35,165,89,0.32),0_10px_24px_rgba(35,165,89,0.25)]"
								: "bg-transparent text-(--accent-success) hover:bg-(--accent-success) hover:text-(--text-inverse)"
						}`}
					>
						<div
							class={`absolute -left-2 h-7 w-1.5 rounded-full transition-all duration-300 ${
								isAreaActive("explorer")
									? "opacity-100"
									: "opacity-0 group-hover:opacity-70"
							}`}
							style={{ "background-color": "var(--accent-success)" }}
						/>
						<Compass size={22} stroke-width={2} />
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_explorer")}</TooltipContent>
				</Tooltip>

				{/* Top: Friends */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Friends"
						onClick={() => openArea("friends")}
						class={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-3xl transition-all duration-300 ease-out flex items-center justify-center shrink-0 group ${
							isAreaActive("friends")
								? "rounded-2xl bg-[#8b5cf6] text-(--text-inverse) shadow-[0_0_0_2px_rgba(139,92,246,0.3),0_10px_24px_rgba(139,92,246,0.25)]"
								: "bg-transparent text-[#a78bfa] hover:bg-[#8b5cf6] hover:text-(--text-inverse)"
						}`}
					>
						<div
							class={`absolute -left-2 h-7 w-1.5 rounded-full transition-all duration-300 ${
								isAreaActive("friends")
									? "opacity-100"
									: "opacity-0 group-hover:opacity-70"
							}`}
							style={{ "background-color": "#8b5cf6" }}
						/>
						<div class="relative">
							<Users size={22} stroke-width={2} />
							{friendsStore.incoming.length > 0 && !isAreaActive("friends") && (
								<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-(--accent-primary) text-(--text-inverse) text-[9px] font-bold flex items-center justify-center leading-none">
									{friendsStore.incoming.length > 9
										? "9+"
										: friendsStore.incoming.length}
								</span>
							)}
						</div>
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_friends")}</TooltipContent>
				</Tooltip>

				{/* Separator - underneath default actions, before servers */}
				<div class="w-6 sm:w-8 h-0.5 bg-(--border-subtle) rounded-full mx-auto my-3 transition-all duration-300" />
				{/* Spacer (Servers list will go here in the future) */}
				<div class="flex-1 w-full flex flex-col items-center gap-2">
					{/* Placeholder for server icons */}
				</div>

				{/* Bottom: User Profile Picture */}
				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					class="hidden"
					onChange={(event) => {
						void handleProfileImagePicked(event);
					}}
				/>
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Profile"
						onClick={handleSelectProfileImage}
						class="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl transition-all duration-300 ease-out bg-transparent overflow-hidden shrink-0 mt-2 flex items-center justify-center hover:opacity-80 cursor-pointer"
					>
						<img
							src={profileImageSrc()}
							alt={user()?.display_name || user()?.username || "User profile"}
							class="w-full h-full object-cover transition-all duration-300 ease-out"
							onError={(e) => {
								e.currentTarget.src = fallbackProfileImage;
							}}
						/>
					</TooltipTrigger>
					<TooltipContent>
						{(isUploadingImage()
							? `${t("home", "sidebar_profile_uploading")}: `
							: "") +
							(user()?.display_name ||
								user()?.username ||
								t("home", "sidebar_profile"))}
					</TooltipContent>
				</Tooltip>
			</nav>

			{/* Main Content Area */}
			<div class="flex-1 bg-(--surface-primary) rounded-tl-lg overflow-hidden flex flex-col">
				<div class="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
					{isAreaActive("friends") ? (
						<FriendsPanel />
					) : (
						<>
							<h2 class="text-xl font-semibold">
								{isAreaActive("messages")
									? t("home", "messages_title")
									: isAreaActive("explorer")
										? t("home", "explorer_title")
										: t("home", "title")}
							</h2>
							<p class="text-sm text-(--text-secondary) max-w-2xl">
								{t("home", "messages_preview_hint")}
							</p>
							<div class="pt-1">
								<button
									type="button"
									onClick={simulateIncomingMessage}
									class="px-3 py-2 rounded-lg bg-(--surface-secondary) hover:bg-(--surface-tertiary) text-sm transition-colors duration-200"
								>
									{t("home", "simulate_message_btn")}
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
