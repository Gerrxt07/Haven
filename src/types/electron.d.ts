export interface IElectronAPI {
	appVersion: () => Promise<string>;
	loadChangelog: (
		fromVersion: string,
		toVersion: string,
	) => Promise<{
		entries: Array<{
			sha: string;
			summary: string;
			details: string;
			url: string;
		}>;
		source: "compare" | "latest";
		fallbackUrl: string;
	}>;
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
	storeAuthTokens: (
		accessToken: string,
		refreshToken: string,
	) => Promise<boolean>;
	loadAuthTokens: () => Promise<{
		accessToken: string | null;
		refreshToken: string | null;
	} | null>;
	deleteAuthTokens: () => Promise<boolean>;
	e2eeStoreSet: (key: string, value: string) => Promise<boolean>;
	e2eeStoreGet: (key: string) => Promise<string | null>;
	e2eeStoreDelete: (key: string) => Promise<boolean>;
	cacheStoreSet: (
		namespace: string,
		key: string,
		value: string,
	) => Promise<boolean>;
	cacheStoreGet: (namespace: string, key: string) => Promise<string | null>;
	cacheStoreDelete: (namespace: string, key: string) => Promise<boolean>;
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
