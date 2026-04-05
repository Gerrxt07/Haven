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
	writeDetailedLog: (payload: {
		scope: string;
		event: string;
		level?: "debug" | "info" | "warn" | "error";
		data?: Record<string, unknown>;
	}) => ipcRenderer.invoke("write-detailed-log", payload) as Promise<boolean>,
	onWindowStateChanged: (
		callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
	) => {
		const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
			if (
				typeof state === "object" &&
				state !== null &&
				"isMaximized" in state &&
				"isFullScreen" in state
			) {
				callback(
					state as {
						isMaximized: boolean;
						isFullScreen: boolean;
					},
				);
			}
		};

		ipcRenderer.on("window-state-changed", listener);
		return () => ipcRenderer.removeListener("window-state-changed", listener);
	},

	// Add to your existing electronAPI context bridge
	storeToken: (token: string) =>
		ipcRenderer.invoke("secure-store-token", token),
	loadToken: () =>
		ipcRenderer.invoke("secure-load-token") as Promise<string | null>,
	deleteToken: () =>
		ipcRenderer.invoke("secure-delete-token") as Promise<boolean>,
	secureStoreSet: (namespace: string, key: string, value: string) =>
		ipcRenderer.invoke(
			"secure-store-set",
			namespace,
			key,
			value,
		) as Promise<boolean>,
	secureStoreGet: (namespace: string, key: string) =>
		ipcRenderer.invoke("secure-store-get", namespace, key) as Promise<
			string | null
		>,
	secureStoreDelete: (namespace: string, key: string) =>
		ipcRenderer.invoke(
			"secure-store-delete",
			namespace,
			key,
		) as Promise<boolean>,

	// External Link Handling Methods
	onExternalLinkWarning: (callback: (url: string) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, url: unknown) => {
			if (typeof url === "string" && url.length > 0) {
				callback(url);
			}
		};

		ipcRenderer.on("show-external-link-warning", listener);
		return () =>
			ipcRenderer.removeListener("show-external-link-warning", listener);
	},
	confirmOpenUrl: (url: string) => ipcRenderer.send("confirm-open-url", url),
	getUpdateCandidate: () =>
		ipcRenderer.invoke("updater-get-candidate") as Promise<
			"release" | "nightly" | null
		>,
	setUpdateCandidate: (candidate: "release" | "nightly") =>
		ipcRenderer.invoke("updater-set-candidate", candidate) as Promise<boolean>,

	validateEmailDomain: (domain: string) =>
		ipcRenderer.invoke("validate-email-domain", domain) as Promise<boolean>,
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
