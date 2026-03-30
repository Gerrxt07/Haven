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
function createWindow() {
	const { width: screenWidth, height: screenHeight } = electron.screen.getPrimaryDisplay().workAreaSize;
	mainWindow = new electron.BrowserWindow({
		width: Math.max(1280, Math.floor(screenWidth * .8)),
		height: Math.max(720, Math.floor(screenHeight * .8)),
		minWidth: 800,
		minHeight: 600,
		title: "Haven",
		frame: false,
		icon: !!process.env.VITE_DEV_SERVER_URL ? node_path.default.join(__dirname, "../public/logo.png") : node_path.default.join(__dirname, "../dist/logo.png"),
		webPreferences: {
			preload: node_path.default.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(node_path.default.join(__dirname, "../dist/index.html"));
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http:") || url.startsWith("https:")) mainWindow?.webContents.send("show-external-link-warning", url);
		return { action: "deny" };
	});
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (!url.startsWith(process.env.VITE_DEV_SERVER_URL || "file://")) {
			event.preventDefault();
			mainWindow?.webContents.send("show-external-link-warning", url);
		}
	});
}
electron.app.whenReady().then(() => {
	electron.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
		if ([
			"media",
			"audioCapture",
			"videoCapture"
		].includes(permission)) callback(true);
		else callback(false);
	});
	createWindow();
	electron.ipcMain.on("confirm-open-url", (_event, url) => {
		electron.shell.openExternal(url);
	});
	electron.ipcMain.on("window-minimize", () => {
		mainWindow?.minimize();
	});
	electron.ipcMain.on("window-maximize", () => {
		if (mainWindow?.isMaximized()) mainWindow.unmaximize();
		else mainWindow?.maximize();
	});
	electron.ipcMain.on("window-close", () => {
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
