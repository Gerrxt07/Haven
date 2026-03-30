let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	platform: process.platform,
	minimize: () => electron.ipcRenderer.send("window-minimize"),
	maximize: () => electron.ipcRenderer.send("window-maximize"),
	close: () => electron.ipcRenderer.send("window-close"),
	onExternalLinkWarning: (callback) => {
		electron.ipcRenderer.on("show-external-link-warning", (_event, url) => callback(url));
	},
	confirmOpenUrl: (url) => electron.ipcRenderer.send("confirm-open-url", url)
});
globalThis.addEventListener("DOMContentLoaded", () => {
	const replaceText = (selector, text) => {
		const element = document.getElementById(selector);
		if (element) element.innerText = text;
	};
	for (const dependency of [
		"chrome",
		"node",
		"electron"
	]) replaceText(`${dependency}-version`, process.versions[dependency]);
});
//#endregion
