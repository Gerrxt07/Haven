import { MessageCircle, ShieldCheck, Users } from "lucide-solid";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../components/ui/tooltip";
import { t } from "../i18n";
import { authSession } from "../lib/auth/session";
import { resolveProfileImageForUser } from "../lib/cache/profile-images";
import { dmService } from "../lib/dm";
import { friendsService } from "../lib/friends/service";
import {
	writeDetailedErrorLog,
	writeDetailedLog,
} from "../lib/logging/detailed";
import DirectMessagesPanel from "./DirectMessagesPanel";
import FriendsPanel from "./FriendsPanel";

export default function Home() {
	type ActiveView = "chats" | "contacts";

	const [authState, setAuthState] = createSignal(authSession.snapshot());
	const [isUploadingImage, setIsUploadingImage] = createSignal(false);
	const [activeView, setActiveView] = createSignal<ActiveView>("chats");
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	const [profileImageSrc, setProfileImageSrc] =
		createSignal(fallbackProfileImage);
	let imageInputRef: HTMLInputElement | undefined;
	let imageResolveToken = 0;

	const user = () => authState().currentUser;
	const currentUserMemo = createMemo(() => authState().currentUser);
	const accessTokenMemo = createMemo(() => authState().accessToken);
	const currentAvatarRef = createMemo(() => {
		const currentUser = currentUserMemo();
		return (
			currentUser?.avatar_url ??
			currentUser?.profile_image_url ??
			currentUser?.profile_picture_url ??
			currentUser?.profile_picture ??
			currentUser?.image_url ??
			currentUser?.photo_url ??
			currentUser?.avatarUrl ??
			currentUser?.profilePictureUrl ??
			currentUser?.avatar ??
			null
		);
	});
	const avatarResolveKey = createMemo(
		() =>
			`${currentUserMemo()?.id ?? "none"}|${currentAvatarRef() ?? ""}|${
				accessTokenMemo() ?? ""
			}`,
	);

	onMount(() => {
		const unsub = authSession.onChange(setAuthState);
		void friendsService.init();
		void dmService.init();

		onCleanup(() => unsub());
	});

	createEffect(() => {
		avatarResolveKey();

		const currentUser = currentUserMemo();
		const accessToken = accessTokenMemo();
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
		<div class="flex h-full w-full flex-col bg-(--surface-primary) text-(--text-primary)">
			<header class="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-(--border-subtle) bg-(--surface-secondary) px-3 py-2 sm:px-4">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-primary) text-(--text-inverse)">
					<ShieldCheck size={18} />
				</div>
				<div class="min-w-0 flex-1">
					<h1 class="truncate text-sm font-semibold leading-5 text-(--text-primary)">
						{t("home", "secure_chat_title")}
					</h1>
					<p class="truncate text-xs text-(--text-secondary)">
						{t("home", "secure_chat_subtitle")}
					</p>
				</div>

				<div class="flex h-9 rounded-xl border border-(--border-subtle) bg-(--surface-primary) p-1">
					<button
						type="button"
						onClick={() => setActiveView("chats")}
						class={`inline-flex items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors duration-150 ${
							activeView() === "chats"
								? "bg-(--accent-primary) text-(--text-inverse)"
								: "text-(--text-secondary) hover:text-(--text-primary)"
						}`}
					>
						<MessageCircle size={14} />
						{t("home", "chats_tab")}
					</button>
					<button
						type="button"
						onClick={() => setActiveView("contacts")}
						class={`inline-flex items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors duration-150 ${
							activeView() === "contacts"
								? "bg-(--accent-primary) text-(--text-inverse)"
								: "text-(--text-secondary) hover:text-(--text-primary)"
						}`}
					>
						<Users size={14} />
						{t("home", "contacts_tab")}
					</button>
				</div>

				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					class="hidden"
					onChange={(event) => {
						void handleProfileImagePicked(event);
					}}
				/>
				<Tooltip placement="bottom">
					<TooltipTrigger
						as="button"
						aria-label="Profile"
						onClick={handleSelectProfileImage}
						class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-(--border-subtle) bg-transparent transition-opacity duration-200 hover:opacity-80 disabled:opacity-60"
						disabled={isUploadingImage()}
					>
						<img
							src={profileImageSrc()}
							alt={user()?.display_name || user()?.username || "User profile"}
							class="h-full w-full object-cover"
							onError={(event) => {
								if (event.currentTarget.src !== fallbackProfileImage) {
									event.currentTarget.src = fallbackProfileImage;
								}
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
			</header>

			<main class="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
				{activeView() === "contacts" ? (
					<FriendsPanel
						onOpenDirectMessage={(peerUserId) => {
							setActiveView("chats");
							void dmService.startThreadWithPeer(peerUserId);
						}}
					/>
				) : (
					<DirectMessagesPanel />
				)}
			</main>
		</div>
	);
}
