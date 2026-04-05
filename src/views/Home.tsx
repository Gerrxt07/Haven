import { Compass, Home as HomeIcon } from "lucide-solid";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../components/ui/tooltip";
import { t } from "../i18n";
import { authSession } from "../lib/auth/session";
import { resolveProfileImageForUser } from "../lib/cache/profile-images";
import {
	writeDetailedErrorLog,
	writeDetailedLog,
} from "../lib/logging/detailed";

export default function Home() {
	const [authState, setAuthState] = createSignal(authSession.snapshot());
	const [isUploadingImage, setIsUploadingImage] = createSignal(false);
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	const [profileImageSrc, setProfileImageSrc] =
		createSignal(fallbackProfileImage);
	let imageInputRef: HTMLInputElement | undefined;

	const user = () => authState().currentUser;
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
		<div class="flex h-full w-full bg-[#313338] text-white">
			{/* Workspace Sidebar */}
			<nav class="w-14 sm:w-16 shrink-0 bg-[#1e1f22] flex flex-col items-center py-3 overflow-y-auto hidden-scrollbar transition-all duration-200">
				{/* Top: Home */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Home"
						class="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl transition-all duration-300 ease-out bg-transparent hover:bg-[#5865f2] text-[#dbdee1] hover:text-white flex items-center justify-center shrink-0 mb-2 group"
					>
						<HomeIcon size={22} stroke-width={2} />
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_home")}</TooltipContent>
				</Tooltip>
				{/* Top: Explorer */}
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Explorer"
						class="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl transition-all duration-300 ease-out bg-transparent hover:bg-[#23a559] text-[#23a559] hover:text-white flex items-center justify-center shrink-0 group"
					>
						<Compass size={22} stroke-width={2} />
					</TooltipTrigger>
					<TooltipContent>{t("home", "sidebar_explorer")}</TooltipContent>
				</Tooltip>

				{/* Separator - underneath default actions, before servers */}
				<div class="w-6 sm:w-8 h-0.5 bg-[#35363c] rounded-full mx-auto my-3 transition-all duration-300" />
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
			<div class="flex-1 bg-[#313338] rounded-tl-lg overflow-hidden flex flex-col">
				<div class="flex-1 p-4">{t("home", "title")}</div>
			</div>
		</div>
	);
}
