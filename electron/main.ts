// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Electron main process

import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import path from "node:path";
import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	nativeTheme,
	safeStorage,
	screen,
	session,
	shell,
	Tray,
} from "electron";
import { initializeSecureLogger, secureLogger } from "./secure-logger";
import {
	buildTimeReleaseChannel,
	getUpdateChannelCandidate,
	runStartupUpdateFlow,
	setUpdateChannelCandidate,
	type UpdateChannelCandidate,
} from "./updater";

// Set up a path to store your encrypted auth data
const authFilePath = path.join(app.getPath("userData"), "auth.enc");
const secureStoreBasePath = path.join(app.getPath("userData"), "secure-store");
const maxStoredSecretLength = 8192;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isAppQuitting = false;

// In-memory cache for the auth token to avoid disk I/O and decryption overhead on every request
let cachedAuthToken: string | null = null;
const WINDOWS_APP_USER_MODEL_ID = "com.haven.app";

if (process.platform === "win32") {
	app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}

// Initialize secure logging
initializeSecureLogger();
secureLogger.logLifecycle("app-starting", {
	platform: process.platform,
	arch: process.arch,
	nodeVersion: process.version,
	electronVersion: process.versions.electron,
	isPackaged: app.isPackaged,
	cwd: process.cwd(),
});

function restoreMainWindow(): void {
	secureLogger.logWindowState("restore-requested");
	if (!mainWindow) {
		secureLogger.logWindowState("window-null-creating-new");
		createWindow();
		return;
	}

	if (mainWindow.isMinimized()) {
		secureLogger.logWindowState("restoring-from-minimized");
		mainWindow.restore();
	}

	if (!mainWindow.isVisible()) {
		secureLogger.logWindowState("showing-hidden-window");
		mainWindow.show();
	}

	mainWindow.focus();
	secureLogger.logWindowState("window-restored");
}

type DetailedLogPayload = {
	scope: string;
	event: string;
	level?: "debug" | "info" | "warn" | "error";
	data?: Record<string, unknown>;
};

function getDetailedLogPath(): string {
	return path.join(app.getPath("logs"), "detailed.log");
}

function serializeDetailedLogLine(payload: DetailedLogPayload): string {
	return JSON.stringify({
		timestamp: new Date().toISOString(),
		scope: payload.scope,
		event: payload.event,
		level: payload.level ?? "info",
		data: payload.data ?? {},
	});
}

async function appendDetailedLog(
	payload: DetailedLogPayload,
): Promise<boolean> {
	try {
		const logPath = getDetailedLogPath();
		await fs.mkdir(path.dirname(logPath), { recursive: true });
		await fs.appendFile(logPath, `${serializeDetailedLogLine(payload)}\n`, {
			encoding: "utf8",
		});
		return true;
	} catch (error) {
		console.error("Failed to append detailed log", error);
		return false;
	}
}

function isTrustedSender(sender: Electron.WebContents): boolean {
	if (!mainWindow) return false;
	return sender === mainWindow.webContents;
}

// Listeners to save and load tokens securely
ipcMain.handle("secure-store-token", async (event, token: string) => {
	secureLogger.logIpc("in", "secure-store-token", "main", {
		hasToken: !!token,
	});
	if (!isTrustedSender(event.sender)) {
		secureLogger.logSecurity("untrusted-sender-rejected", {
			channel: "secure-store-token",
		});
		return false;
	}
	if (typeof token !== "string" || token.length < 1) return false;
	if (token.length > maxStoredSecretLength) return false;

	if (safeStorage.isEncryptionAvailable()) {
		const encryptedToken = safeStorage.encryptString(token);
		await writeEncryptedFile(authFilePath, encryptedToken);
		// Update the in-memory cache
		cachedAuthToken = token;
		secureLogger.logSecurity("token-stored", { path: authFilePath });
		return true;
	}
	secureLogger.logSecurity(
		"token-storage-failed",
		{ reason: "encryption-unavailable" },
		"error",
	);
	return false; // Handle fallback if encryption isn't available
});

ipcMain.handle("secure-load-token", async (event) => {
	secureLogger.logIpc("in", "secure-load-token", "main");
	if (!isTrustedSender(event.sender)) {
		secureLogger.logSecurity("untrusted-sender-rejected", {
			channel: "secure-load-token",
		});
		return null;
	}
	if (!safeStorage.isEncryptionAvailable()) return null;

	try {
		const encryptedToken = await fs.readFile(authFilePath);
		const decryptedToken = safeStorage.decryptString(encryptedToken);
		// Update the in-memory cache
		cachedAuthToken = decryptedToken;
		secureLogger.logSecurity("token-loaded");
		return decryptedToken;
	} catch {
		secureLogger.debug("auth", "token-load-failed", {
			reason: "file-not-found-or-decryption-failed",
		});
		return null;
	}
});

ipcMain.handle("secure-delete-token", async (event) => {
	secureLogger.logIpc("in", "secure-delete-token", "main");
	if (!isTrustedSender(event.sender)) {
		secureLogger.logSecurity("untrusted-sender-rejected", {
			channel: "secure-delete-token",
		});
		return false;
	}

	try {
		await fs.unlink(authFilePath);
		// Clear the in-memory cache
		cachedAuthToken = null;
		secureLogger.logSecurity("token-deleted");
		return true;
	} catch {
		secureLogger.debug("auth", "token-delete-failed", {
			reason: "file-not-found",
		});
		return false;
	}
});

function sanitizeNamespace(value: string): string | null {
	if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
		return null;
	}
	return value;
}

function sanitizeKey(value: string): string | null {
	if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)) {
		return null;
	}
	return value;
}

function getSecureStorePath(namespace: string): string {
	return path.join(secureStoreBasePath, `${namespace}.enc`);
}

async function readSecureNamespace(
	namespace: string,
): Promise<Record<string, string>> {
	const filePath = getSecureStorePath(namespace);

	try {
		const encrypted = await fs.readFile(filePath);
		if (!safeStorage.isEncryptionAvailable()) {
			return {};
		}
		const plain = safeStorage.decryptString(encrypted);
		const parsed: unknown = JSON.parse(plain);

		if (typeof parsed === "object" && parsed !== null) {
			const out: Record<string, string> = {};
			for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof v === "string") {
					out[k] = v;
				}
			}
			return out;
		}

		return {};
	} catch {
		return {};
	}
}

async function writeSecureNamespace(
	namespace: string,
	value: Record<string, string>,
): Promise<boolean> {
	if (!safeStorage.isEncryptionAvailable()) {
		return false;
	}

	const filePath = getSecureStorePath(namespace);
	await fs.mkdir(secureStoreBasePath, { recursive: true });
	const plaintext = JSON.stringify(value);
	const encrypted = safeStorage.encryptString(plaintext);
	await writeEncryptedFile(filePath, encrypted);
	return true;
}

function getErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}

	const { code } = error as { code?: unknown };
	return typeof code === "string" ? code : undefined;
}

async function cleanupTempFile(tempPath: string): Promise<void> {
	try {
		await fs.rm(tempPath, { force: true });
	} catch {
		// Best-effort cleanup only.
	}
}

async function writeEncryptedFile(
	filePath: string,
	encryptedBytes: Buffer,
): Promise<void> {
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
	await fs.writeFile(tempPath, encryptedBytes, { mode: 0o600 });

	try {
		await fs.rename(tempPath, filePath);
		return;
	} catch (error) {
		const errorCode = getErrorCode(error);
		const canRetryWithReplace =
			process.platform === "win32" &&
			(errorCode === "EEXIST" || errorCode === "EPERM");

		if (!canRetryWithReplace) {
			await cleanupTempFile(tempPath);
			throw error;
		}
	}

	try {
		await fs.rm(filePath, { force: true });
		await fs.rename(tempPath, filePath);
	} catch (error) {
		await cleanupTempFile(tempPath);
		throw error;
	}
}

ipcMain.handle(
	"secure-store-set",
	async (event, namespace: string, key: string, value: string) => {
		secureLogger.logIpc("in", "secure-store-set", "main", { namespace, key });
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "secure-store-set",
			});
			return false;
		}

		const ns = sanitizeNamespace(namespace);
		const safeKey = sanitizeKey(key);
		if (!ns || !safeKey || typeof value !== "string") {
			return false;
		}
		if (value.length > maxStoredSecretLength) {
			return false;
		}

		const doc = await readSecureNamespace(ns);
		doc[safeKey] = value;

		try {
			const result = await writeSecureNamespace(ns, doc);
			secureLogger.logSecurity("secure-store-set-success", {
				namespace: ns,
				key: safeKey,
			});
			return result;
		} catch (error) {
			secureLogger.logError("secure-store", "write-failed", error, {
				namespace: ns,
			});
			return false;
		}
	},
);

ipcMain.handle(
	"secure-store-get",
	async (event, namespace: string, key: string) => {
		secureLogger.logIpc("in", "secure-store-get", "main", { namespace, key });
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "secure-store-get",
			});
			return null;
		}

		const ns = sanitizeNamespace(namespace);
		const safeKey = sanitizeKey(key);
		if (!ns || !safeKey) {
			return null;
		}

		const doc = await readSecureNamespace(ns);
		const hasValue = !!doc[safeKey];
		secureLogger.logIpc("out", "secure-store-get", "main", {
			namespace: ns,
			key: safeKey,
			found: hasValue,
		});
		return doc[safeKey] ?? null;
	},
);

ipcMain.handle(
	"secure-store-delete",
	async (event, namespace: string, key: string) => {
		secureLogger.logIpc("in", "secure-store-delete", "main", {
			namespace,
			key,
		});
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "secure-store-delete",
			});
			return false;
		}

		const ns = sanitizeNamespace(namespace);
		const safeKey = sanitizeKey(key);
		if (!ns || !safeKey) {
			return false;
		}

		const doc = await readSecureNamespace(ns);
		if (!(safeKey in doc)) {
			return true;
		}

		delete doc[safeKey];

		try {
			const result = await writeSecureNamespace(ns, doc);
			secureLogger.logSecurity("secure-store-delete-success", {
				namespace: ns,
				key: safeKey,
			});
			return result;
		} catch (error) {
			secureLogger.logError("secure-store", "delete-failed", error, {
				namespace: ns,
				key: safeKey,
			});
			return false;
		}
	},
);

function getCurrentWindowState() {
	return {
		isMaximized: mainWindow?.isMaximized() ?? false,
		isFullScreen: mainWindow?.isFullScreen() ?? false,
	};
}

function notifyWindowStateChanged() {
	if (!mainWindow) {
		return;
	}

	const state = getCurrentWindowState();
	secureLogger.logWindowState("state-changed", state);
	mainWindow.webContents.send("window-state-changed", state);
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const trustedDevOrigin = (() => {
	// SECURITY: Use app.isPackaged to reliably detect production builds.
	// process.env can be manipulated by users when launching the app.
	if (app.isPackaged) {
		return null;
	}

	if (!devServerUrl) {
		return null;
	}

	try {
		const parsedUrl = new URL(devServerUrl);
		const isLocalHost =
			parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
		return isLocalHost ? parsedUrl.origin : null;
	} catch {
		return null;
	}
})();

const isDevelopmentBuild = !app.isPackaged;
const allowDevNoSandbox =
	isDevelopmentBuild &&
	process.argv.some((arg) => arg === "--no-sandbox") &&
	process.env.HAVEN_ALLOW_DEV_NO_SANDBOX === "1";

if (allowDevNoSandbox) {
	secureLogger.logSecurity(
		"dev-no-sandbox-enabled",
		{
			reason: "explicit-opt-in",
			env: "HAVEN_ALLOW_DEV_NO_SANDBOX=1",
		},
		"warn",
	);
	console.warn(
		"Running with --no-sandbox in development due to HAVEN_ALLOW_DEV_NO_SANDBOX=1.",
	);
}

function isTrustedAppUrl(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol === "file:") {
			return true;
		}

		return trustedDevOrigin !== null && parsedUrl.origin === trustedDevOrigin;
	} catch {
		return url.startsWith("file://");
	}
}

function isTrustedOrigin(origin: string): boolean {
	if (origin === "file://") {
		return true;
	}

	if (!trustedDevOrigin) {
		return false;
	}

	return origin === trustedDevOrigin;
}

function isSafeExternalHttpUrl(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.username || parsedUrl.password) {
			return false;
		}

		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
	} catch {
		return false;
	}
}

function getRequestSecurityOrigin(
	details:
		| Electron.PermissionRequest
		| Electron.FilesystemPermissionRequest
		| Electron.MediaAccessPermissionRequest
		| Electron.OpenExternalPermissionRequest,
): string | null {
	if (
		"securityOrigin" in details &&
		typeof details.securityOrigin === "string"
	) {
		return details.securityOrigin;
	}

	return null;
}

function getContentSecurityPolicy(): string {
	const commonDirectives = [
		"default-src 'self'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"object-src 'none'",
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"media-src 'self' blob:",
		"worker-src 'self' blob:",
	];

	if (trustedDevOrigin) {
		return [
			...commonDirectives,
			"script-src 'self' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			`connect-src 'self' ${trustedDevOrigin} ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://havenapi.becloudly.eu wss://havenapi.becloudly.eu stun: turn:`,
		].join("; ");
	}

	return [
		...commonDirectives,
		"script-src 'self'",
		"style-src 'self'",
		"connect-src 'self' https://havenapi.becloudly.eu wss://havenapi.becloudly.eu stun: turn:",
	].join("; ");
}

// Strip dangerous command line arguments commonly used by stealers
const dangerousArgs = [
	"--remote-debugging-port",
	"--remote-debugging-pipe",
	"--inspect",
	"--inspect-brk",
	"--enable-blink-features",
	"--js-flags",
	"--no-sandbox",
	"--proxy-server",
	"--proxy-bypass-list",
	"--host-resolver-rules",
	"--allow-file-access-from-files",
	"--disable-web-security",
	"--disable-features",
	"--enable-features",
	"--load-extension",
	"--disable-extensions-except",
	"--whitelisted-ips",
	"--tor-proxy",
	"--explicitly-allowed-ports",
	"--ignore-certificate-errors",
	"--ignore-certificate-errors-spki-list",
	"--ignore-urlfetcher-cert-requests",
];

// SECURITY: Forcefully remove dangerous switches at the Chromium engine level.
// This is a defense-in-depth measure in addition to the blacklist check.
const switchesToRemove = [
	"remote-debugging-port",
	"remote-debugging-pipe",
	"inspect",
	"inspect-brk",
	"enable-blink-features",
	"js-flags",
	"proxy-server",
	"proxy-bypass-list",
	"host-resolver-rules",
	"allow-file-access-from-files",
	"disable-web-security",
	"disable-features",
	"enable-features",
	"load-extension",
	"disable-extensions-except",
	"whitelisted-ips",
	"tor-proxy",
	"explicitly-allowed-ports",
	"ignore-certificate-errors",
	"ignore-certificate-errors-spki-list",
	"ignore-urlfetcher-cert-requests",
];

if (!allowDevNoSandbox) {
	switchesToRemove.push("no-sandbox");
}

for (const switchName of switchesToRemove) {
	app.commandLine.removeSwitch(switchName);
}

for (const arg of process.argv) {
	if (allowDevNoSandbox && arg === "--no-sandbox") {
		continue;
	}

	if (dangerousArgs.some((danger) => arg.startsWith(danger))) {
		secureLogger.logSecurity(
			"dangerous-arg-detected",
			{ arg: arg.split("=")[0] },
			"error",
		);
		console.error("Dangerous command line argument detected. Exiting.");
		app.quit();
		process.exit(1);
	}
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
	secureLogger.logLifecycle("single-instance-lock-failed", { quitting: true });
	app.quit();
} else {
	secureLogger.logLifecycle("single-instance-lock-acquired");
	app.on("second-instance", () => {
		secureLogger.logLifecycle("second-instance-detected");
		restoreMainWindow();
	});
}

function createWindow() {
	secureLogger.logWindowState("creating-window");
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width: screenWidth, height: screenHeight } =
		primaryDisplay.workAreaSize;
	secureLogger.logWindowState("screen-info", { screenWidth, screenHeight });

	const width = Math.max(1280, Math.floor(screenWidth * 0.8));
	const height = Math.max(720, Math.floor(screenHeight * 0.8));

	const iconPath = getAppIconPath();

	mainWindow = new BrowserWindow({
		width,
		height,
		minWidth: 1280,
		minHeight: 720,
		title: `Haven v${app.getVersion()}`,
		show: false,
		frame: false,
		backgroundColor: "#272727",
		icon: iconPath,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: !allowDevNoSandbox,
			enableWebSQL: false,
			disableBlinkFeatures: "Auxclick",
			v8CacheOptions: "bypassHeatCheck",
			spellcheck: false,
			webSecurity: true,
			allowRunningInsecureContent: false,
			navigateOnDragDrop: false,
			webviewTag: false,
		},
	});
	secureLogger.logWindowState("window-created", { width, height });

	if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
		secureLogger.logWindowState("loading-dev-url", {
			url: process.env.VITE_DEV_SERVER_URL,
		});
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		secureLogger.logWindowState("loading-production-file");
		mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	mainWindow.on("close", (event) => {
		if (!isAppQuitting) {
			secureLogger.logWindowState("close-prevented-hiding");
			event.preventDefault();
			mainWindow?.hide();
		} else {
			secureLogger.logWindowState("window-closing");
		}
	});

	mainWindow.once("ready-to-show", () => {
		secureLogger.logWindowState("ready-to-show");
		mainWindow?.setTitle(`Haven v${app.getVersion()}`);
		mainWindow?.show();
		notifyWindowStateChanged();
	});

	let resizeTimeout: NodeJS.Timeout | null = null;
	function notifyWindowStateChangedThrottled() {
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
			resizeTimeout = null; // Explicitly nullify for GC
		}
		resizeTimeout = setTimeout(() => {
			notifyWindowStateChanged();
			resizeTimeout = null;
		}, 100);
	}

	mainWindow.on("maximize", () => {
		secureLogger.logWindowState("maximized");
		notifyWindowStateChangedThrottled();
	});
	mainWindow.on("unmaximize", () => {
		secureLogger.logWindowState("unmaximized");
		notifyWindowStateChangedThrottled();
	});
	mainWindow.on("enter-full-screen", () => {
		secureLogger.logWindowState("enter-full-screen");
		notifyWindowStateChangedThrottled();
	});
	mainWindow.on("leave-full-screen", () => {
		secureLogger.logWindowState("leave-full-screen");
		notifyWindowStateChangedThrottled();
	});
	mainWindow.on("resize", notifyWindowStateChangedThrottled);

	// Prevent links from navigating inside the app
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		secureLogger.logNavigation(url, "window-open-attempt");
		if (isSafeExternalHttpUrl(url)) {
			// Trigger a warning in the frontend UI instead of opening immediately
			mainWindow?.webContents.send("show-external-link-warning", url);
		}
		return { action: "deny" };
	});

	// Prevent drag-and-drop navigation (e.g., dropping an HTML file into the chat)
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (!isTrustedAppUrl(url)) {
			secureLogger.logSecurity("untrusted-navigation-blocked", { url });
			event.preventDefault();
			// Trigger a warning in the frontend UI instead of opening immediately
			if (isSafeExternalHttpUrl(url)) {
				mainWindow?.webContents.send("show-external-link-warning", url);
			}
		} else {
			secureLogger.logNavigation(url, "will-navigate");
		}
	});

	mainWindow.webContents.on("will-attach-webview", (event) => {
		secureLogger.logSecurity("webview-attachment-blocked");
		event.preventDefault();
	});
}

function getAppIconPath(): string {
	const isDev = !app.isPackaged;
	return isDev
		? path.join(__dirname, "../public/logo.png")
		: path.join(__dirname, "../dist/logo.png");
}

function createTray() {
	if (tray) return;

	const iconPath = getAppIconPath();

	tray = new Tray(iconPath);
	tray.setToolTip("Haven");

	const contextMenu = Menu.buildFromTemplate([
		{
			label: "Haven öffnen",
			click: () => {
				restoreMainWindow();
			},
		},
		{ type: "separator" },
		{
			label: "Beenden",
			click: () => {
				isAppQuitting = true;
				app.quit();
			},
		},
	]);

	tray.setContextMenu(contextMenu);

	tray.on("click", () => {
		restoreMainWindow();
	});
}

Menu.setApplicationMenu(null);

// Prevent WebRTC from leaking local IP addresses
app.commandLine.appendSwitch(
	"force-webrtc-ip-handling-policy",
	"default_public_interface_only",
);

app.whenReady().then(() => {
	secureLogger.logLifecycle("app-ready");
	nativeTheme.themeSource = "dark";
	createTray();

	const contentSecurityPolicy = getContentSecurityPolicy();

	app.on("browser-window-created", (_, window) => {
		// SECURITY: Prevent DevTools from opening in Production.
		// Use app.isPackaged instead of process.env to avoid bypass via environment variables.
		if (app.isPackaged) {
			window.webContents.on("devtools-opened", () => {
				window.webContents.closeDevTools();
			});
		}
	});

	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		const responseHeaders = details.responseHeaders ?? {};

		if (details.resourceType === "mainFrame" || isTrustedAppUrl(details.url)) {
			responseHeaders["Content-Security-Policy"] = [contentSecurityPolicy];
		}

		callback({ responseHeaders });
	});

	session.defaultSession.webRequest.onBeforeSendHeaders(
		{ urls: ["https://havenapi.becloudly.eu/*"] }, // Only attach to your trusted backend API
		async (details, callback) => {
			// Use the cached token instead of reading from disk on every request
			let token = cachedAuthToken;

			// Fallback to loading from disk if cache is empty
			if (!token && safeStorage.isEncryptionAvailable()) {
				try {
					const encryptedToken = await fs.readFile(authFilePath);
					token = safeStorage.decryptString(encryptedToken);
					// Update the cache for future requests
					cachedAuthToken = token;
				} catch {
					/* ignore */
				}
			}

			if (token) {
				details.requestHeaders.Authorization = `Bearer ${token}`;
			}

			callback({ requestHeaders: details.requestHeaders });
		},
	);

	session.defaultSession.on("will-download", (event, item, webContents) => {
		const fileName = item.getFilename();
		const dangerousExtensions = [
			".exe",
			".scr",
			".vbs",
			".bat",
			".cmd",
			".msi",
			".ps1",
		];
		const ext = path.extname(fileName).toLowerCase();

		if (dangerousExtensions.includes(ext)) {
			event.preventDefault(); // Block the download entirely
			secureLogger.logDownload(fileName, "blocked", {
				reason: "dangerous-extension",
				ext,
			});

			// Optionally notify the renderer to show a warning UI
			webContents.send(
				"show-external-link-warning",
				`Blocked download of potentially dangerous file: ${fileName}`,
			);
			console.warn(`Blocked dangerous download: ${fileName}`);
		} else {
			secureLogger.logDownload(fileName, "started");
			// Optional: Force a "Save As" dialog so files don't silently drop into the Downloads folder
			item.setSaveDialogOptions({ title: "Save File" });
			item.once("done", (_, state) => {
				if (state === "completed") {
					secureLogger.logDownload(fileName, "completed");
				}
			});
		}
	});

	// Handle WebRTC Permissions for Voice/Video calls
	session.defaultSession.setPermissionCheckHandler(
		(_webContents, permission, requestingOrigin) => {
			const allowedPermissions = ["media", "audioCapture", "videoCapture"];

			if (!allowedPermissions.includes(permission)) {
				return false;
			}

			if (!requestingOrigin) {
				return false;
			}

			return isTrustedOrigin(requestingOrigin);
		},
	);

	session.defaultSession.setPermissionRequestHandler(
		(webContents, permission, callback, details) => {
			const allowedPermissions = ["media", "audioCapture", "videoCapture"];
			const requestUrl = webContents.getURL();
			const requestingOrigin = getRequestSecurityOrigin(details) ?? "";

			if (
				allowedPermissions.includes(permission) &&
				isTrustedAppUrl(requestUrl) &&
				isTrustedOrigin(requestingOrigin)
			) {
				callback(true);
			} else {
				callback(false);
			}
		},
	);

	void runStartupUpdateFlow({
		iconPath: getAppIconPath(),
		onReadyToLaunch: () => {
			if (!mainWindow) {
				createWindow();
			}
		},
	});

	ipcMain.handle("get-window-state", (event) => {
		if (!isTrustedSender(event.sender)) return null;
		return getCurrentWindowState();
	});

	ipcMain.handle("get-app-version", () => {
		return app.getVersion();
	});

	secureLogger.logLifecycle("ipc-handlers-registered");

	ipcMain.handle(
		"write-detailed-log",
		async (event, payload: DetailedLogPayload) => {
			if (!isTrustedSender(event.sender)) return false;
			if (
				typeof payload !== "object" ||
				payload === null ||
				typeof payload.scope !== "string" ||
				typeof payload.event !== "string"
			) {
				return false;
			}

			return appendDetailedLog(payload);
		},
	);

	ipcMain.handle("updater-get-candidate", async (event) => {
		if (!isTrustedSender(event.sender)) return null;
		return getUpdateChannelCandidate();
	});

	ipcMain.handle("updater-get-build-channel", async (event) => {
		if (!isTrustedSender(event.sender)) return null;
		return buildTimeReleaseChannel;
	});

	secureLogger.logLifecycle("updater-initialized");

	ipcMain.handle(
		"updater-set-candidate",
		async (event, candidate: UpdateChannelCandidate) => {
			if (!isTrustedSender(event.sender)) return false;
			return setUpdateChannelCandidate(candidate);
		},
	);

	// Validate email domain mx lookup
	function normalizeEmailDomain(input: string): string | null {
		if (typeof input !== "string") {
			return null;
		}

		const domain = input.trim().toLowerCase();
		if (!domain || domain.length > 253) {
			return null;
		}

		// Basic domain validation (ASCII). UI email validation already runs first.
		if (
			!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
		) {
			return null;
		}

		return domain;
	}

	// Validate email domain via DNS: prefer MX, fallback to A/AAAA for RFC-compatible receivers.
	ipcMain.handle("validate-email-domain", async (event, domain: string) => {
		if (!isTrustedSender(event.sender)) return false;

		const normalizedDomain = normalizeEmailDomain(domain);
		if (!normalizedDomain) {
			return false;
		}

		try {
			const records = await dns.resolveMx(normalizedDomain);
			return records && records.length > 0;
		} catch {
			// Some domains may accept mail on host A/AAAA even without MX records.
			try {
				const [a, aaaa] = await Promise.allSettled([
					dns.resolve4(normalizedDomain),
					dns.resolve6(normalizedDomain),
				]);

				const hasA = a.status === "fulfilled" && a.value.length > 0;
				const hasAaaa = aaaa.status === "fulfilled" && aaaa.value.length > 0;

				return hasA || hasAaaa;
			} catch {
				return false;
			}
		}
	});

	// Listen for user confirming to open an external link from the UI warning
	ipcMain.on("confirm-open-url", (event, url) => {
		secureLogger.logIpc("in", "confirm-open-url", "main", { url });
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "confirm-open-url",
			});
			return;
		}
		if (typeof url !== "string") {
			return;
		}

		if (isSafeExternalHttpUrl(url)) {
			secureLogger.logNavigation(url, "external-url-opened");
			shell.openExternal(url);
		}
	});

	// IPC listeners for the custom title bar
	ipcMain.on("window-minimize", (event) => {
		secureLogger.logIpc("in", "window-minimize", "main");
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "window-minimize",
			});
			return;
		}
		secureLogger.logWindowState("minimize-requested");
		mainWindow?.minimize();
	});

	ipcMain.on("window-maximize", (event) => {
		secureLogger.logIpc("in", "window-maximize", "main");
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "window-maximize",
			});
			return;
		}
		if (mainWindow?.isMaximized()) {
			secureLogger.logWindowState("unmaximize-requested");
			mainWindow.unmaximize();
		} else {
			secureLogger.logWindowState("maximize-requested");
			mainWindow?.maximize();
		}
	});

	ipcMain.on("window-close", (event) => {
		secureLogger.logIpc("in", "window-close", "main");
		if (!isTrustedSender(event.sender)) {
			secureLogger.logSecurity("untrusted-sender-rejected", {
				channel: "window-close",
			});
			return;
		}
		secureLogger.logWindowState("close-requested");
		mainWindow?.close();
	});

	app.on("activate", () => {
		secureLogger.logLifecycle("app-activate");
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	secureLogger.logLifecycle("window-all-closed");
	if (process.platform !== "darwin") {
		secureLogger.logLifecycle("app-quitting");
		app.quit();
	}
});
