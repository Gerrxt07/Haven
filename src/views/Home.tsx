import { Compass, Home as HomeIcon } from "lucide-solid";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../components/ui/tooltip";
import { t } from "../i18n";
import { authSession } from "../lib/auth/session";

export default function Home() {
	const user = () => authSession.snapshot().currentUser;
	const fallbackProfileImage = "./profile.png";

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
				<Tooltip placement="right">
					<TooltipTrigger
						as="button"
						aria-label="Profile"
						class="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl transition-all duration-300 ease-out bg-transparent overflow-hidden shrink-0 mt-2 flex items-center justify-center hover:opacity-80 cursor-pointer"
					>
						<img
							src={fallbackProfileImage}
							alt={user()?.display_name || user()?.username || "User profile"}
							class="w-full h-full object-cover transition-all duration-300 ease-out"
							onError={(e) => {
								e.currentTarget.src = fallbackProfileImage;
							}}
						/>
					</TooltipTrigger>
					<TooltipContent>
						{user()?.display_name ||
							user()?.username ||
							t("home", "sidebar_profile")}
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
