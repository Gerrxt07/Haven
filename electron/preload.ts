// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Electron preload script
import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
	// Example IPC method
	// send: (channel: string, data: any) => ipcRenderer.send(channel, data)
	// platform: process.platform,
	minimize: () => ipcRenderer.send("window-minimize"),
	maximize: () => ipcRenderer.send("window-maximize"),
	close: () => ipcRenderer.send("window-close"),
	getWindowState: () =>
		ipcRenderer.invoke("get-window-state") as Promise<{
			isMaximized: boolean;
			isFullScreen: boolean;
		}>,
	onWindowStateChanged: (
		callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
	) => {
		ipcRenderer.on("window-state-changed", (_event, state) => callback(state));
	},

	// Add to your existing electronAPI context bridge
	storeToken: (token: string) =>
		ipcRenderer.invoke("secure-store-token", token),

	// External Link Handling Methods
	onExternalLinkWarning: (callback: (url: string) => void) => {
		ipcRenderer.on("show-external-link-warning", (_event, url) =>
			callback(url),
		);
	},
	confirmOpenUrl: (url: string) => ipcRenderer.send("confirm-open-url", url),
	getUpdateCandidate: () =>
		ipcRenderer.invoke("updater-get-candidate") as Promise<
			"release" | "nightly" | null
		>,
	setUpdateCandidate: (candidate: "release" | "nightly") =>
		ipcRenderer.invoke("updater-set-candidate", candidate) as Promise<boolean>,
});

globalThis.addEventListener("DOMContentLoaded", () => {
	const replaceText = (selector: string, text: string) => {
		const element = document.getElementById(selector);
		if (element) element.innerText = text;
	};

	for (const dependency of ["chrome", "node", "electron"]) {
		replaceText(
			`${dependency}-version`,
			process.versions[dependency as keyof typeof process.versions] as string,
		);
	}
});
