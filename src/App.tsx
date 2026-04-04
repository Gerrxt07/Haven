import {
	MessageCircleQuestion,
	Minus,
	Settings,
	Square,
	User,
	X,
} from "lucide-solid";
import {
	createSignal,
	lazy,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from "solid-js";
import { CommandPaletteField } from "./components/ui/command-palette-field";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "./components/ui/tooltip";
import { t, tf } from "./i18n";
import { authSession } from "./lib/auth/session";

const HomeView = lazy(() => import("./views/Home"));
const AuthView = lazy(() => import("./views/Auth"));

export default function App() {
	const [isExpanded, setIsExpanded] = createSignal(false);
	const [authState, setAuthState] = createSignal(authSession.snapshot());

	onMount(() => {
		const unsub = authSession.onChange(setAuthState);
		onCleanup(() => unsub());
		// Hook up the titlebar buttons to their respective IPC events
		document.getElementById("min-btn")?.addEventListener("click", () => {
			globalThis.electronAPI.minimize();
		});

		document.getElementById("max-btn")?.addEventListener("click", () => {
			globalThis.electronAPI.maximize();
		});

		document.getElementById("close-btn")?.addEventListener("click", () => {
			globalThis.electronAPI.close();
		});

		document.getElementById("help-btn")?.addEventListener("click", () => {
			globalThis.electronAPI.confirmOpenUrl("https://haven.becloudly.eu/help");
		});

		// Listen for external link clicks intercepted by Electron
		globalThis.electronAPI.onExternalLinkWarning((url) => {
			// TODO: Replace this native confirm with a beautifully styled SolidJS Modal / Dialog later
			console.log(`[Link Intercepted]: ${url}`);
			const userConfirmed = globalThis.confirm(
				tf("app", "externalLinkWarning", { url }),
			);

			if (userConfirmed) {
				globalThis.electronAPI.confirmOpenUrl(url);
			}
		});

		globalThis.electronAPI.onWindowStateChanged((state) => {
			setIsExpanded(state.isMaximized || state.isFullScreen);
		});

		globalThis.electronAPI.getWindowState().then((state) => {
			setIsExpanded(state.isMaximized || state.isFullScreen);
		});
	});

	return (
		<div class="flex flex-col h-screen w-full bg-[#272727] text-white">
			{/* Titlebar */}
			<div
				class="h-8 bg-[#1e1f22] flex justify-between items-center select-none relative"
				style={{ "-webkit-app-region": "drag" }}
			>
				{/* Spacer */}
				<div class="w-34.5"></div>

				{/* Center Title */}
				<div class="absolute inset-0 flex justify-center items-center text-[13px] font-semibold text-[#a0a0a0] pointer-events-none">
					{t("app", "title")}
				</div>

				{/* Controls */}
				<div class="flex h-full" style={{ "-webkit-app-region": "no-drag" }}>
					<div class="h-full flex items-center justify-center">
						<CommandPaletteField />
					</div>

					<Show when={authState().currentUser}>
						<div class="h-full px-2 relative flex items-center">
							<Tooltip placement="bottom">
								<TooltipTrigger
									as="button"
									id="account-btn"
									class="h-full border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
								>
									<User size={15} stroke-width={2} aria-hidden="true" />
								</TooltipTrigger>
								<TooltipContent>{t("app", "account")}</TooltipContent>
							</Tooltip>
						</div>

						<div class="h-full px-2 relative flex items-center">
							<Tooltip placement="bottom">
								<TooltipTrigger
									as="button"
									id="settings-btn"
									class="h-full border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
								>
									<Settings size={15} stroke-width={2} aria-hidden="true" />
								</TooltipTrigger>
								<TooltipContent>{t("app", "settings")}</TooltipContent>
							</Tooltip>
						</div>
					</Show>

					<div class="h-full px-2 relative flex items-center">
						<Tooltip placement="bottom">
							<TooltipTrigger
								as="button"
								id="help-btn"
								class="h-full border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
							>
								<MessageCircleQuestion
									size={15}
									stroke-width={2}
									aria-hidden="true"
								/>
							</TooltipTrigger>
							<TooltipContent>{t("app", "help")}</TooltipContent>
						</Tooltip>
					</div>

					<div class="h-full flex items-center justify-center pr-1">
						<div class="w-px h-4 bg-white/10"></div>
					</div>

					<button
						type="button"
						id="min-btn"
						class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10"
					>
						<Minus size={14} stroke-width={2} aria-hidden="true" />
					</button>
					<button
						type="button"
						id="max-btn"
						class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10"
					>
						{isExpanded() ? (
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
							>
								<rect
									x="1.5"
									y="3.5"
									width="7"
									height="7"
									stroke="currentColor"
									stroke-width="1.2"
								/>
								<path
									d="M4 1.5H10.5V8"
									stroke="currentColor"
									stroke-width="1.2"
								/>
							</svg>
						) : (
							<Square size={12} stroke-width={2} aria-hidden="true" />
						)}
					</button>
					<button
						type="button"
						id="close-btn"
						class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[#e81123] hover:text-white"
					>
						<X size={14} stroke-width={2} aria-hidden="true" />
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-auto relative">
				<Suspense
					fallback={
						<div class="flex items-center justify-center h-full">
							{t("app", "loading")}
						</div>
					}
				>
					<Show
						when={authState().isReady}
						fallback={
							<div class="flex items-center justify-center h-full">
								{t("app", "loading")}
							</div>
						}
					>
						<Show when={authState().currentUser} fallback={<AuthView />}>
							<HomeView />
						</Show>
					</Show>
				</Suspense>
			</div>
		</div>
	);
}
