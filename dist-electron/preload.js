let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	platform: process.platform,
	minimize: () => electron.ipcRenderer.send("window-minimize"),
	maximize: () => electron.ipcRenderer.send("window-maximize"),
	close: () => electron.ipcRenderer.send("window-close")
});
window.addEventListener("DOMContentLoaded", () => {
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
