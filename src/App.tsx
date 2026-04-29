import {
	Command,
	LogOut,
	MessageCircleQuestion,
	Minus,
	Moon,
	Settings,
	Square,
	Sun,
	User,
	X,
} from "lucide-solid";
import {
	createEffect,
	createMemo,
	createSignal,
	lazy,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from "solid-js";
import { Motion } from "solid-motionone";
import { ChangelogModal } from "./components/ui/changelog-modal";
import {
	CommandPalette,
	type CommandPaletteAction,
	CommandPaletteField,
} from "./components/ui/command-palette-field";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "./components/ui/tooltip";
import { t, tf } from "./i18n";
import { authSession } from "./lib/auth/session";
import type { ChangelogData } from "./lib/changelog";
import { currentTheme, toggleTheme } from "./lib/theme";

const HomeView = lazy(() => import("./views/Home"));
const AuthView = lazy(() => import("./views/Auth"));
const LAST_SEEN_VERSION_STORAGE_KEY = "haven.lastSeenVersion";

export default function App() {
	const [isExpanded, setIsExpanded] = createSignal(false);
	const [authState, setAuthState] = createSignal(authSession.snapshot());
	const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
	const [openMenu, setOpenMenu] = createSignal<"account" | "settings" | null>(
		null,
	);
	const [activeSurface, setActiveSurface] = createSignal<"auth" | "home">(
		"auth",
	);
	const [exitingSurface, setExitingSurface] = createSignal<
		"auth" | "home" | null
	>(null);
	const [appVersion, setAppVersion] = createSignal("");
	const [changelogModal, setChangelogModal] = createSignal<{
		fromVersion: string;
		toVersion: string;
		entries: ChangelogData["entries"];
		source: ChangelogData["source"];
		fallbackUrl: string;
	} | null>(null);
	let surfaceTransitionTimeout: ReturnType<typeof setTimeout> | undefined;

	const openHelp = () => {
		globalThis.electronAPI.confirmOpenUrl("https://haven.becloudly.eu/help");
	};

	const closeMenus = () => setOpenMenu(null);

	const runMenuAction = (action: () => void | Promise<void>) => {
		closeMenus();
		void action();
	};

	const readLastSeenVersion = () => {
		try {
			const value = globalThis.localStorage.getItem(
				LAST_SEEN_VERSION_STORAGE_KEY,
			);
			if (typeof value !== "string" || value.trim().length === 0) {
				return null;
			}

			return value.trim();
		} catch {
			return null;
		}
	};

	const persistLastSeenVersion = (version: string) => {
		try {
			globalThis.localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, version);
		} catch {
			// Ignore storage errors (private mode / restricted contexts).
		}
	};

	const initializeChangelog = async (currentVersion: string) => {
		const normalizedCurrentVersion = currentVersion.trim();
		if (!normalizedCurrentVersion) {
			return;
		}

		const lastSeenVersion = readLastSeenVersion();
		if (!lastSeenVersion) {
			persistLastSeenVersion(normalizedCurrentVersion);
			return;
		}

		if (lastSeenVersion === normalizedCurrentVersion) {
			return;
		}

		try {
			const changelog = await globalThis.electronAPI.loadChangelog(
				lastSeenVersion,
				normalizedCurrentVersion,
			);
			setChangelogModal({
				fromVersion: lastSeenVersion,
				toVersion: normalizedCurrentVersion,
				entries: changelog.entries,
				source: changelog.source,
				fallbackUrl: changelog.fallbackUrl,
			});
		} catch (error) {
			console.warn("Could not load changelog commits", error);
			setChangelogModal({
				fromVersion: lastSeenVersion,
				toVersion: normalizedCurrentVersion,
				entries: [],
				source: "latest",
				fallbackUrl: "https://github.com/Gerrxt07/Haven/commits/master",
			});
		}
	};

	const acknowledgeChangelog = () => {
		const currentVersion = appVersion().trim();
		if (currentVersion) {
			persistLastSeenVersion(currentVersion);
		}
		setChangelogModal(null);
	};

	const commandActions = createMemo<CommandPaletteAction[]>(() => [
		{
			id: "help",
			label: t("app", "commandOpenHelp"),
			description: t("app", "commandOpenHelpDesc"),
			shortcut: "F1",
			icon: MessageCircleQuestion,
			run: openHelp,
		},
		{
			id: "toggle-theme",
			label:
				currentTheme() === "dark"
					? t("app", "commandThemeLight")
					: t("app", "commandThemeDark"),
			description:
				currentTheme() === "dark"
					? t("app", "commandThemeLightDesc")
					: t("app", "commandThemeDarkDesc"),
			shortcut: "",
			icon: currentTheme() === "dark" ? Sun : Moon,
			run: () => toggleTheme(),
		},
		{
			id: "logout",
			label: t("app", "commandLogout"),
			description: t("app", "commandLogoutDesc"),
			shortcut: "",
			icon: LogOut,
			run: () => authSession.logout(),
		},
		{
			id: "minimize",
			label: t("app", "commandMinimize"),
			description: t("app", "commandMinimizeDesc"),
			shortcut: "Alt+M",
			icon: Minus,
			run: () => globalThis.electronAPI.minimize(),
		},
		{
			id: "toggle-maximize",
			label: isExpanded()
				? t("app", "commandRestore")
				: t("app", "commandMaximize"),
			description: isExpanded()
				? t("app", "commandRestoreDesc")
				: t("app", "commandMaximizeDesc"),
			shortcut: "Alt+Enter",
			icon: Square,
			run: () => globalThis.electronAPI.maximize(),
		},
		{
			id: "close-window",
			label: t("app", "commandCloseWindow"),
			description: t("app", "commandCloseWindowDesc"),
			shortcut: "Alt+F4",
			icon: X,
			run: () => globalThis.electronAPI.close(),
		},
	]);

	createEffect(() => {
		if (!authState().isReady) {
			return;
		}

		const nextSurface = authState().currentUser ? "home" : "auth";
		if (activeSurface() === nextSurface) {
			return;
		}

		if (surfaceTransitionTimeout) {
			clearTimeout(surfaceTransitionTimeout);
		}

		setExitingSurface(activeSurface());
		setActiveSurface(nextSurface);
		surfaceTransitionTimeout = setTimeout(() => {
			setExitingSurface(null);
			surfaceTransitionTimeout = undefined;
		}, 520);
	});

	onMount(async () => {
		const version = await globalThis.electronAPI.appVersion();
		setAppVersion(version);
		void initializeChangelog(version);

		const unsub = authSession.onChange(setAuthState);
		onCleanup(() => unsub());
		onCleanup(() => {
			if (surfaceTransitionTimeout) {
				clearTimeout(surfaceTransitionTimeout);
			}
		});
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

		document.getElementById("help-btn")?.addEventListener("click", openHelp);

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

		const handleGlobalKeydown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && openMenu() !== null) {
				event.preventDefault();
				closeMenus();
				return;
			}

			if (!authState().currentUser) {
				return;
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setIsCommandPaletteOpen((open) => !open);
				return;
			}

			if (isCommandPaletteOpen()) {
				return;
			}

			if (event.key === "F1") {
				event.preventDefault();
				openHelp();
				return;
			}

			if (event.altKey && event.key.toLowerCase() === "m") {
				event.preventDefault();
				globalThis.electronAPI.minimize();
				return;
			}

			if (event.altKey && event.key === "Enter") {
				event.preventDefault();
				globalThis.electronAPI.maximize();
			}
		};

		globalThis.addEventListener("keydown", handleGlobalKeydown);
		onCleanup(() =>
			globalThis.removeEventListener("keydown", handleGlobalKeydown),
		);

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}
			if (target.closest("[data-app-menu]")) {
				return;
			}
			closeMenus();
		};

		globalThis.addEventListener("pointerdown", handlePointerDown);
		onCleanup(() =>
			globalThis.removeEventListener("pointerdown", handlePointerDown),
		);
	});

	return (
		<div class="flex flex-col h-screen w-full bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
			{/* Titlebar */}
			<div
				class="h-8 bg-[color:var(--titlebar-bg)] flex justify-between items-center select-none relative"
				style={{ "-webkit-app-region": "drag" }}
			>
				{/* Spacer */}
				<div class="w-34.5"></div>

				{/* Center Title */}
				<div class="absolute inset-0 flex justify-center items-center text-[13px] font-semibold text-[color:var(--titlebar-text)] pointer-events-none">
					{t("app", "title")} v{appVersion()}
				</div>

				{/* Controls */}
				<div class="flex h-full" style={{ "-webkit-app-region": "no-drag" }}>
					<Show when={authState().currentUser}>
						<div class="h-full flex items-center justify-center">
							<CommandPaletteField
								isOpen={isCommandPaletteOpen()}
								onOpen={() => setIsCommandPaletteOpen(true)}
							/>
						</div>
					</Show>

					<Show when={authState().currentUser}>
						<div
							class="h-full px-2 relative flex items-center"
							data-app-menu="account"
						>
							<Tooltip placement="bottom">
								<TooltipTrigger
									as="button"
									id="account-btn"
									aria-haspopup="menu"
									aria-expanded={openMenu() === "account"}
									onClick={() =>
										setOpenMenu((menu) =>
											menu === "account" ? null : "account",
										)
									}
									class="h-full border-none bg-transparent text-[color:var(--titlebar-text)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[color:var(--titlebar-icon-hover)] p-0"
								>
									<User size={15} stroke-width={2} aria-hidden="true" />
								</TooltipTrigger>
								<TooltipContent>{t("app", "account")}</TooltipContent>
							</Tooltip>
							<Show when={openMenu() === "account"}>
								<div
									role="menu"
									aria-label={t("app", "account")}
									class="absolute right-0 top-full z-[90] mt-1 w-64 overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-secondary)] shadow-[var(--shadow-float)]"
								>
									<div class="border-b border-[color:var(--border-subtle)] px-3 py-2.5">
										<p class="truncate text-sm font-semibold text-[color:var(--text-primary)]">
											{authState().currentUser?.display_name ||
												authState().currentUser?.username}
										</p>
										<p class="truncate text-[11px] text-[color:var(--text-secondary)]">
											@{authState().currentUser?.username}
										</p>
									</div>
									<button
										type="button"
										role="menuitem"
										onClick={() => runMenuAction(() => authSession.logout())}
										class="flex h-9 w-full items-center gap-2 border-none bg-transparent px-3 text-left text-sm text-[color:var(--text-primary)] transition-colors duration-150 hover:bg-[color:var(--surface-primary)]"
									>
										<LogOut size={14} aria-hidden="true" />
										{t("app", "commandLogout")}
									</button>
								</div>
							</Show>
						</div>

						<div
							class="h-full px-2 relative flex items-center"
							data-app-menu="settings"
						>
							<Tooltip placement="bottom">
								<TooltipTrigger
									as="button"
									id="settings-btn"
									aria-haspopup="menu"
									aria-expanded={openMenu() === "settings"}
									onClick={() =>
										setOpenMenu((menu) =>
											menu === "settings" ? null : "settings",
										)
									}
									class="h-full border-none bg-transparent text-[color:var(--titlebar-text)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[color:var(--titlebar-icon-hover)] p-0"
								>
									<Settings size={15} stroke-width={2} aria-hidden="true" />
								</TooltipTrigger>
								<TooltipContent>{t("app", "settings")}</TooltipContent>
							</Tooltip>
							<Show when={openMenu() === "settings"}>
								<div
									role="menu"
									aria-label={t("app", "settings")}
									class="absolute right-0 top-full z-[90] mt-1 w-64 overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-secondary)] py-1 shadow-[var(--shadow-float)]"
								>
									<button
										type="button"
										role="menuitem"
										onClick={() => runMenuAction(() => toggleTheme())}
										class="flex h-9 w-full items-center gap-2 border-none bg-transparent px-3 text-left text-sm text-[color:var(--text-primary)] transition-colors duration-150 hover:bg-[color:var(--surface-primary)]"
									>
										{currentTheme() === "dark" ? (
											<Sun size={14} aria-hidden="true" />
										) : (
											<Moon size={14} aria-hidden="true" />
										)}
										{currentTheme() === "dark"
											? t("app", "commandThemeLight")
											: t("app", "commandThemeDark")}
									</button>
									<button
										type="button"
										role="menuitem"
										onClick={() =>
											runMenuAction(() => {
												setIsCommandPaletteOpen(true);
											})
										}
										class="flex h-9 w-full items-center gap-2 border-none bg-transparent px-3 text-left text-sm text-[color:var(--text-primary)] transition-colors duration-150 hover:bg-[color:var(--surface-primary)]"
									>
										<Command size={14} aria-hidden="true" />
										{t("app", "commandPalette")}
									</button>
									<button
										type="button"
										role="menuitem"
										onClick={() => runMenuAction(openHelp)}
										class="flex h-9 w-full items-center gap-2 border-none bg-transparent px-3 text-left text-sm text-[color:var(--text-primary)] transition-colors duration-150 hover:bg-[color:var(--surface-primary)]"
									>
										<MessageCircleQuestion size={14} aria-hidden="true" />
										{t("app", "commandOpenHelp")}
									</button>
								</div>
							</Show>
						</div>
					</Show>

					<div class="h-full px-2 relative flex items-center">
						<Tooltip placement="bottom">
							<TooltipTrigger
								as="button"
								id="help-btn"
								class="h-full border-none bg-transparent text-[color:var(--titlebar-text)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:text-[color:var(--titlebar-icon-hover)] p-0"
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
						<div class="w-px h-4 bg-[color:var(--titlebar-divider)]"></div>
					</div>

					<button
						type="button"
						id="min-btn"
						class="w-11.5 h-full border-none bg-transparent text-[color:var(--titlebar-icon)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[color:var(--titlebar-hover)]"
					>
						<Minus size={14} stroke-width={2} aria-hidden="true" />
					</button>
					<button
						type="button"
						id="max-btn"
						class="w-11.5 h-full border-none bg-transparent text-[color:var(--titlebar-icon)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[color:var(--titlebar-hover)]"
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
						class="w-11.5 h-full border-none bg-transparent text-[color:var(--titlebar-icon)] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[color:var(--titlebar-close-hover)] hover:text-[color:var(--titlebar-close-text)]"
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
						<div class="relative h-full w-full overflow-hidden">
							<Show when={exitingSurface() === "auth"}>
								<div class="absolute inset-0 z-0">
									<Motion.div
										initial={false}
										animate={{
											opacity: 0,
											scale: 1.03,
											filter: "blur(12px)",
											y: -10,
										}}
										transition={{ duration: 0.42, easing: "ease-in-out" }}
										class="h-full w-full"
									>
										<AuthView />
									</Motion.div>
								</div>
							</Show>

							<Show when={exitingSurface() === "home"}>
								<div class="absolute inset-0 z-0">
									<Motion.div
										initial={false}
										animate={{
											opacity: 0,
											scale: 0.985,
											filter: "blur(16px)",
											y: 18,
										}}
										transition={{ duration: 0.42, easing: "ease-in-out" }}
										class="h-full w-full"
									>
										<HomeView />
									</Motion.div>
								</div>
							</Show>

							<div class="absolute inset-0 z-10">
								<Show when={activeSurface() === "home"} fallback={<AuthView />}>
									<Motion.div
										initial={{
											opacity: 0,
											scale: activeSurface() === "home" ? 0.985 : 1.03,
											filter:
												activeSurface() === "home"
													? "blur(16px)"
													: "blur(12px)",
											y: activeSurface() === "home" ? 22 : -12,
										}}
										animate={{
											opacity: 1,
											scale: 1,
											filter: "blur(0px)",
											y: 0,
										}}
										transition={{
											duration: 0.46,
											easing: [0.22, 1, 0.36, 1],
										}}
										class="h-full w-full"
									>
										<Show
											when={activeSurface() === "home"}
											fallback={<AuthView />}
										>
											<HomeView />
										</Show>
									</Motion.div>
								</Show>
							</div>
						</div>
					</Show>
				</Suspense>
			</div>
			<Show when={authState().currentUser}>
				<CommandPalette
					open={isCommandPaletteOpen()}
					onOpenChange={setIsCommandPaletteOpen}
					actions={commandActions()}
				/>
			</Show>
			<Show when={changelogModal()}>
				{(modal) => (
					<ChangelogModal
						open={true}
						fromVersion={modal().fromVersion}
						toVersion={modal().toVersion}
						entries={modal().entries}
						source={modal().source}
						fallbackUrl={modal().fallbackUrl}
						onAcknowledge={acknowledgeChangelog}
					/>
				)}
			</Show>
		</div>
	);
}
