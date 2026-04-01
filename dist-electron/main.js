//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let node_path = require("node:path");
node_path = __toESM(node_path);
//#region electron/main.ts
var mainWindow = null;
function getCurrentWindowState() {
	return {
		isMaximized: mainWindow?.isMaximized() ?? false,
		isFullScreen: mainWindow?.isFullScreen() ?? false
	};
}
function notifyWindowStateChanged() {
	if (!mainWindow) return;
	mainWindow.webContents.send("window-state-changed", getCurrentWindowState());
}
var devServerUrl = process.env.VITE_DEV_SERVER_URL;
var trustedDevOrigin = (() => {
	if (!devServerUrl) return null;
	try {
		const parsedUrl = new URL(devServerUrl);
		return parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" ? parsedUrl.origin : null;
	} catch {
		return null;
	}
})();
function isTrustedAppUrl(url) {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol === "file:") return true;
		return trustedDevOrigin !== null && parsedUrl.origin === trustedDevOrigin;
	} catch {
		return url.startsWith("file://");
	}
}
function isTrustedOrigin(origin) {
	if (origin === "file://") return true;
	if (!trustedDevOrigin) return false;
	return origin === trustedDevOrigin;
}
function isSafeExternalHttpUrl(url) {
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
	} catch {
		return false;
	}
}
function getContentSecurityPolicy() {
	const commonDirectives = [
		"default-src 'self'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"object-src 'none'",
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"media-src 'self' blob:",
		"worker-src 'self' blob:"
	];
	if (trustedDevOrigin) return [
		...commonDirectives,
		"script-src 'self' 'unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		`connect-src 'self' ${trustedDevOrigin} ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* stun: turn:`
	].join("; ");
	return [
		...commonDirectives,
		"script-src 'self'",
		"style-src 'self'",
		"connect-src 'self' stun: turn:"
	].join("; ");
}
function createWindow() {
	const { width: screenWidth, height: screenHeight } = electron.screen.getPrimaryDisplay().workAreaSize;
	mainWindow = new electron.BrowserWindow({
		width: Math.max(1280, Math.floor(screenWidth * .8)),
		height: Math.max(720, Math.floor(screenHeight * .8)),
		minWidth: 1280,
		minHeight: 720,
		title: "Haven",
		show: false,
		frame: false,
		backgroundColor: "#272727",
		icon: !!process.env.VITE_DEV_SERVER_URL ? node_path.default.join(__dirname, "../public/logo.png") : node_path.default.join(__dirname, "../dist/logo.png"),
		webPreferences: {
			preload: node_path.default.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			enableWebSQL: false,
			disableBlinkFeatures: "Auxclick"
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(node_path.default.join(__dirname, "../dist/index.html"));
	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
		notifyWindowStateChanged();
	});
	mainWindow.on("maximize", notifyWindowStateChanged);
	mainWindow.on("unmaximize", notifyWindowStateChanged);
	mainWindow.on("enter-full-screen", notifyWindowStateChanged);
	mainWindow.on("leave-full-screen", notifyWindowStateChanged);
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (isSafeExternalHttpUrl(url)) mainWindow?.webContents.send("show-external-link-warning", url);
		return { action: "deny" };
	});
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (!isTrustedAppUrl(url)) {
			event.preventDefault();
			if (isSafeExternalHttpUrl(url)) mainWindow?.webContents.send("show-external-link-warning", url);
		}
	});
}
electron.app.whenReady().then(() => {
	const contentSecurityPolicy = getContentSecurityPolicy();
	electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		const responseHeaders = details.responseHeaders ?? {};
		if (details.resourceType === "mainFrame" || isTrustedAppUrl(details.url)) responseHeaders["Content-Security-Policy"] = [contentSecurityPolicy];
		callback({ responseHeaders });
	});
	electron.session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
		if (![
			"media",
			"audioCapture",
			"videoCapture"
		].includes(permission)) return false;
		if (!requestingOrigin) return false;
		return isTrustedOrigin(requestingOrigin);
	});
	electron.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
		const allowedPermissions = [
			"media",
			"audioCapture",
			"videoCapture"
		];
		const requestUrl = webContents.getURL();
		if (allowedPermissions.includes(permission) && isTrustedAppUrl(requestUrl)) callback(true);
		else callback(false);
	});
	createWindow();
	function isTrustedSender(sender) {
		if (!mainWindow) return false;
		return sender === mainWindow.webContents;
	}
	electron.ipcMain.handle("get-window-state", (event) => {
		if (!isTrustedSender(event.sender)) return null;
		return getCurrentWindowState();
	});
	electron.ipcMain.on("confirm-open-url", (event, url) => {
		if (!isTrustedSender(event.sender)) return;
		if (typeof url !== "string") return;
		if (isSafeExternalHttpUrl(url)) electron.shell.openExternal(url);
	});
	electron.ipcMain.on("window-minimize", (event) => {
		if (!isTrustedSender(event.sender)) return;
		mainWindow?.minimize();
	});
	electron.ipcMain.on("window-maximize", (event) => {
		if (!isTrustedSender(event.sender)) return;
		if (mainWindow?.isMaximized()) mainWindow.unmaximize();
		else mainWindow?.maximize();
	});
	electron.ipcMain.on("window-close", (event) => {
		if (!isTrustedSender(event.sender)) return;
		mainWindow?.close();
	});
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
//#endregion
