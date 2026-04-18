export interface IElectronAPI {
	appVersion: () => Promise<string>;
	platform: string;
	minimize: () => void;
	maximize: () => void;
	close: () => void;
	getUpdateCandidate: () => Promise<"release" | "nightly" | null>;
	setUpdateCandidate: (candidate: "release" | "nightly") => Promise<boolean>;
	getBuildReleaseChannel: () => Promise<"release" | "nightly" | null>;
	validateEmailDomain: (domain: string) => Promise<boolean>;
	getWindowState: () => Promise<{
		isMaximized: boolean;
		isFullScreen: boolean;
	}>;
	writeDetailedLog: (payload: {
		scope: string;
		event: string;
		level?: "debug" | "info" | "warn" | "error";
		data?: Record<string, unknown>;
	}) => Promise<boolean>;
	onWindowStateChanged: (
		callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
	) => () => void;
	onExternalLinkWarning: (callback: (url: string) => void) => () => void;
	confirmOpenUrl: (url: string) => void;
	storeToken: (token: string) => Promise<boolean>;
	loadToken: () => Promise<string | null>;
	deleteToken: () => Promise<boolean>;
	secureStoreSet: (
		namespace: string,
		key: string,
		value: string,
	) => Promise<boolean>;
	secureStoreGet: (namespace: string, key: string) => Promise<string | null>;
	secureStoreDelete: (namespace: string, key: string) => Promise<boolean>;
}

declare global {
	var electronAPI: IElectronAPI;
	interface Window {
		electronAPI: IElectronAPI;
	}
	/**
	 * Build-time constant indicating the release channel this build was created for.
	 * "nightly" for nightly builds, "release" for stable releases.
	 */
	const __HAVEN_RELEASE_CHANNEL__: "release" | "nightly";
}
