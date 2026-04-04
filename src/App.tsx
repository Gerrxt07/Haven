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
import { Motion, Presence } from "solid-motionone";
import { t, tf } from "./i18n";
import { authSession } from "./lib/auth/session";

const HomeView = lazy(() => import("./views/Home"));
const AuthView = lazy(() => import("./views/Auth"));

export default function App() {
	const [isExpanded, setIsExpanded] = createSignal(false);
	const [helpTooltipOpen, setHelpTooltipOpen] = createSignal(false);
	const [accountTooltipOpen, setAccountTooltipOpen] = createSignal(false);
	const [settingsTooltipOpen, setSettingsTooltipOpen] = createSignal(false);
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
				class="h-8 bg-[#1e1e1e] flex justify-between items-center select-none relative"
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
					<div
						class="flex items-end pb-1.75 px-2 relative h-full"
						onMouseEnter={() => setAccountTooltipOpen(true)}
						onMouseLeave={() => setAccountTooltipOpen(false)}
						onFocus={() => setAccountTooltipOpen(true)}
						onBlur={() => setAccountTooltipOpen(false)}
						role="tooltip"
						aria-label={t("app", "account")}
					>
						<button
							type="button"
							id="account-btn"
							class="border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
						>
							<User size={15} stroke-width={2} aria-hidden="true" />
						</button>

						<Presence>
							<Show when={accountTooltipOpen()}>
								<Motion.div
									initial={{ opacity: 0, scale: 0.95, y: -2 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95, y: -2 }}
									transition={{ duration: 0.15, easing: "ease-out" }}
									class="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#111214] text-[#dcddde] font-semibold text-[13px] rounded-md shadow-lg pointer-events-none whitespace-nowrap z-50 will-change-[transform,opacity]"
								>
									{t("app", "account")}
									<div class="absolute -top-1.25 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-[#111214]"></div>
								</Motion.div>
							</Show>
						</Presence>
					</div>

					<div
						class="flex items-end pb-1.75 px-2 relative h-full"
						onMouseEnter={() => setSettingsTooltipOpen(true)}
						onMouseLeave={() => setSettingsTooltipOpen(false)}
						onFocus={() => setSettingsTooltipOpen(true)}
						onBlur={() => setSettingsTooltipOpen(false)}
						role="tooltip"
						aria-label={t("app", "settings")}
					>
						<button
							type="button"
							id="settings-btn"
							class="border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
						>
							<Settings size={15} stroke-width={2} aria-hidden="true" />
						</button>

						<Presence>
							<Show when={settingsTooltipOpen()}>
								<Motion.div
									initial={{ opacity: 0, scale: 0.95, y: -2 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95, y: -2 }}
									transition={{ duration: 0.15, easing: "ease-out" }}
									class="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#111214] text-[#dcddde] font-semibold text-[13px] rounded-md shadow-lg pointer-events-none whitespace-nowrap z-50 will-change-[transform,opacity]"
								>
									{t("app", "settings")}
									<div class="absolute -top-1.25 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-[#111214]"></div>
								</Motion.div>
							</Show>
						</Presence>
					</div>

					<div
						class="flex items-end pb-1.75 px-2 relative h-full"
						onMouseEnter={() => setHelpTooltipOpen(true)}
						onMouseLeave={() => setHelpTooltipOpen(false)}
						onFocus={() => setHelpTooltipOpen(true)}
						onBlur={() => setHelpTooltipOpen(false)}
						role="tooltip"
						aria-label={t("app", "help")}
					>
						<button
							type="button"
							id="help-btn"
							class="border-none bg-transparent text-[#a0a0a0] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[#dcddde] p-0"
						>
							<MessageCircleQuestion
								size={15}
								stroke-width={2}
								aria-hidden="true"
							/>
						</button>

						{/* Custom Tooltip fully animated via Solid Motion One */}
						<Presence>
							<Show when={helpTooltipOpen()}>
								<Motion.div
									initial={{ opacity: 0, scale: 0.95, y: -2 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95, y: -2 }}
									transition={{ duration: 0.15, easing: "ease-out" }}
									class="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#111214] text-[#dcddde] font-semibold text-[13px] rounded-md shadow-lg pointer-events-none whitespace-nowrap z-50 will-change-[transform,opacity]"
								>
									{t("app", "help")}

									{/* Tooltip Arrow pointing up */}
									<div class="absolute -top-1.25 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-[#111214]"></div>
								</Motion.div>
							</Show>
						</Presence>
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
