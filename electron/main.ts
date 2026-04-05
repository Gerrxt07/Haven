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
import {
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

function restoreMainWindow(): void {
	if (!mainWindow) {
		createWindow();
		return;
	}

	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}

	if (!mainWindow.isVisible()) {
		mainWindow.show();
	}

	mainWindow.focus();
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
	if (!isTrustedSender(event.sender)) return false;
	if (typeof token !== "string" || token.length < 1) return false;
	if (token.length > maxStoredSecretLength) return false;

	if (safeStorage.isEncryptionAvailable()) {
		const encryptedToken = safeStorage.encryptString(token);
		await writeEncryptedFile(authFilePath, encryptedToken);
		return true;
	}
	return false; // Handle fallback if encryption isn't available
});

ipcMain.handle("secure-load-token", async (event) => {
	if (!isTrustedSender(event.sender)) return null;
	if (!safeStorage.isEncryptionAvailable()) return null;

	try {
		const encryptedToken = await fs.readFile(authFilePath);
		return safeStorage.decryptString(encryptedToken);
	} catch {
		return null;
	}
});

ipcMain.handle("secure-delete-token", async (event) => {
	if (!isTrustedSender(event.sender)) return false;

	try {
		await fs.unlink(authFilePath);
		return true;
	} catch {
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
		if (!isTrustedSender(event.sender)) return false;

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
			return await writeSecureNamespace(ns, doc);
		} catch {
			return false;
		}
	},
);

ipcMain.handle(
	"secure-store-get",
	async (event, namespace: string, key: string) => {
		if (!isTrustedSender(event.sender)) return null;

		const ns = sanitizeNamespace(namespace);
		const safeKey = sanitizeKey(key);
		if (!ns || !safeKey) {
			return null;
		}

		const doc = await readSecureNamespace(ns);
		return doc[safeKey] ?? null;
	},
);

ipcMain.handle(
	"secure-store-delete",
	async (event, namespace: string, key: string) => {
		if (!isTrustedSender(event.sender)) return false;

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
			return await writeSecureNamespace(ns, doc);
		} catch {
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

	mainWindow.webContents.send("window-state-changed", getCurrentWindowState());
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const trustedDevOrigin = (() => {
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
];

for (const arg of process.argv) {
	if (dangerousArgs.some((danger) => arg.startsWith(danger))) {
		console.error("Dangerous command line argument detected. Exiting.");
		app.quit();
		process.exit(1);
	}
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		restoreMainWindow();
	});
}

function createWindow() {
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width: screenWidth, height: screenHeight } =
		primaryDisplay.workAreaSize;

	const width = Math.max(1280, Math.floor(screenWidth * 0.8));
	const height = Math.max(720, Math.floor(screenHeight * 0.8));

	const iconPath = getAppIconPath();

	mainWindow = new BrowserWindow({
		width,
		height,
		minWidth: 1280,
		minHeight: 720,
		title: "Haven",
		show: false,
		frame: false,
		backgroundColor: "#272727",
		icon: iconPath,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
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

	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	mainWindow.on("close", (event) => {
		if (!isAppQuitting) {
			event.preventDefault();
			mainWindow?.hide();
		}
	});

	mainWindow.once("ready-to-show", () => {
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

	mainWindow.on("maximize", notifyWindowStateChangedThrottled);
	mainWindow.on("unmaximize", notifyWindowStateChangedThrottled);
	mainWindow.on("enter-full-screen", notifyWindowStateChangedThrottled);
	mainWindow.on("leave-full-screen", notifyWindowStateChangedThrottled);
	mainWindow.on("resize", notifyWindowStateChangedThrottled);

	// Prevent links from navigating inside the app
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (isSafeExternalHttpUrl(url)) {
			// Trigger a warning in the frontend UI instead of opening immediately
			mainWindow?.webContents.send("show-external-link-warning", url);
		}
		return { action: "deny" };
	});

	// Prevent drag-and-drop navigation (e.g., dropping an HTML file into the chat)
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (!isTrustedAppUrl(url)) {
			event.preventDefault();
			// Trigger a warning in the frontend UI instead of opening immediately
			if (isSafeExternalHttpUrl(url)) {
				mainWindow?.webContents.send("show-external-link-warning", url);
			}
		}
	});

	mainWindow.webContents.on("will-attach-webview", (event) => {
		event.preventDefault();
	});
}

function getAppIconPath(): string {
	const isDev = !!process.env.VITE_DEV_SERVER_URL;
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
	nativeTheme.themeSource = "dark";
	createTray();

	const contentSecurityPolicy = getContentSecurityPolicy();

	app.on("browser-window-created", (_, window) => {
		// Prevent DevTools from opening in Production
		if (!process.env.VITE_DEV_SERVER_URL) {
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
			let token = null;
			try {
				const encryptedToken = await fs.readFile(authFilePath);
				token = safeStorage.decryptString(encryptedToken);
			} catch {
				/* ignore */
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

			// Optionally notify the renderer to show a warning UI
			webContents.send(
				"show-external-link-warning",
				`Blocked download of potentially dangerous file: ${fileName}`,
			);
			console.warn(`Blocked dangerous download: ${fileName}`);
		} else {
			// Optional: Force a "Save As" dialog so files don't silently drop into the Downloads folder
			item.setSaveDialogOptions({ title: "Save File" });
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
		if (!isTrustedSender(event.sender)) return;
		if (typeof url !== "string") {
			return;
		}

		if (isSafeExternalHttpUrl(url)) {
			shell.openExternal(url);
		}
	});

	// IPC listeners for the custom title bar
	ipcMain.on("window-minimize", (event) => {
		if (!isTrustedSender(event.sender)) return;
		mainWindow?.minimize();
	});

	ipcMain.on("window-maximize", (event) => {
		if (!isTrustedSender(event.sender)) return;
		if (mainWindow?.isMaximized()) {
			mainWindow.unmaximize();
		} else {
			mainWindow?.maximize();
		}
	});

	ipcMain.on("window-close", (event) => {
		if (!isTrustedSender(event.sender)) return;
		mainWindow?.close();
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
