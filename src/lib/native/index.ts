import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type UpdateChannelCandidate = "release" | "nightly";

export type WindowState = {
	isMaximized: boolean;
	isFullScreen: boolean;
};

export type DetailedLogPayload = {
	scope: string;
	event: string;
	level?: "debug" | "info" | "warn" | "error";
	data?: Record<string, unknown>;
};

export interface NativeDesktopApi {
	minimize: () => Promise<void>;
	maximize: () => Promise<void>;
	close: () => Promise<void>;
	getUpdateCandidate: () => Promise<UpdateChannelCandidate | null>;
	setUpdateCandidate: (candidate: UpdateChannelCandidate) => Promise<boolean>;
	validateEmailDomain: (domain: string) => Promise<boolean>;
	getWindowState: () => Promise<WindowState>;
	writeDetailedLog: (payload: DetailedLogPayload) => Promise<boolean>;
	onWindowStateChanged: (
		callback: (state: WindowState) => void,
	) => Promise<() => void>;
	openExternalUrl: (url: string) => Promise<boolean>;
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
	migrateLegacyState: () => Promise<boolean>;
}

const WINDOW_STATE_EVENT = "haven://window-state-changed";

function isTauriRuntime(): boolean {
	return "__TAURI_INTERNALS__" in globalThis;
}

class MemoryNativeDesktopApi implements NativeDesktopApi {
	private readonly store = new Map<string, string>();

	async minimize(): Promise<void> {}
	async maximize(): Promise<void> {}
	async close(): Promise<void> {}
	async getUpdateCandidate(): Promise<UpdateChannelCandidate | null> {
		return "nightly";
	}
	async setUpdateCandidate(
		_candidate: UpdateChannelCandidate,
	): Promise<boolean> {
		return true;
	}
	async validateEmailDomain(_domain: string): Promise<boolean> {
		return true;
	}
	async getWindowState(): Promise<WindowState> {
		return { isMaximized: false, isFullScreen: false };
	}
	async writeDetailedLog(_payload: DetailedLogPayload): Promise<boolean> {
		return true;
	}
	async onWindowStateChanged(): Promise<() => void> {
		return () => {};
	}
	async openExternalUrl(url: string): Promise<boolean> {
		if (typeof window !== "undefined" && /^https?:\/\//i.test(url)) {
			window.open(url, "_blank", "noopener,noreferrer");
			return true;
		}
		return false;
	}
	async storeToken(token: string): Promise<boolean> {
		this.store.set("auth.legacy", token);
		return true;
	}
	async loadToken(): Promise<string | null> {
		return this.store.get("auth.legacy") ?? null;
	}
	async deleteToken(): Promise<boolean> {
		this.store.delete("auth.legacy");
		return true;
	}
	async secureStoreSet(
		namespace: string,
		key: string,
		value: string,
	): Promise<boolean> {
		this.store.set(`${namespace}:${key}`, value);
		return true;
	}
	async secureStoreGet(namespace: string, key: string): Promise<string | null> {
		return this.store.get(`${namespace}:${key}`) ?? null;
	}
	async secureStoreDelete(namespace: string, key: string): Promise<boolean> {
		this.store.delete(`${namespace}:${key}`);
		return true;
	}
	async migrateLegacyState(): Promise<boolean> {
		return false;
	}
}

class TauriNativeDesktopApi implements NativeDesktopApi {
	private async run<T>(
		command: string,
		args?: Record<string, unknown>,
	): Promise<T> {
		return invoke<T>(command, args);
	}

	async minimize(): Promise<void> {
		await this.run("minimize_window");
	}

	async maximize(): Promise<void> {
		await this.run("toggle_maximize_window");
	}

	async close(): Promise<void> {
		await this.run("close_window");
	}

	async getUpdateCandidate(): Promise<UpdateChannelCandidate | null> {
		return this.run("get_update_candidate");
	}

	async setUpdateCandidate(
		candidate: UpdateChannelCandidate,
	): Promise<boolean> {
		return this.run("set_update_candidate", { candidate });
	}

	async validateEmailDomain(domain: string): Promise<boolean> {
		return this.run("validate_email_domain", { domain });
	}

	async getWindowState(): Promise<WindowState> {
		return this.run("get_window_state");
	}

	async writeDetailedLog(payload: DetailedLogPayload): Promise<boolean> {
		return this.run("write_detailed_log", { payload });
	}

	async onWindowStateChanged(
		callback: (state: WindowState) => void,
	): Promise<() => void> {
		const unlisten: UnlistenFn = await listen<WindowState>(
			WINDOW_STATE_EVENT,
			(event) => callback(event.payload),
		);
		return unlisten;
	}

	async openExternalUrl(url: string): Promise<boolean> {
		return this.run("open_external_url", { url });
	}

	async storeToken(token: string): Promise<boolean> {
		return this.run("store_token", { token });
	}

	async loadToken(): Promise<string | null> {
		return this.run("load_token");
	}

	async deleteToken(): Promise<boolean> {
		return this.run("delete_token");
	}

	async secureStoreSet(
		namespace: string,
		key: string,
		value: string,
	): Promise<boolean> {
		return this.run("secure_store_set", { namespace, key, value });
	}

	async secureStoreGet(namespace: string, key: string): Promise<string | null> {
		return this.run("secure_store_get", { namespace, key });
	}

	async secureStoreDelete(namespace: string, key: string): Promise<boolean> {
		return this.run("secure_store_delete", { namespace, key });
	}

	async migrateLegacyState(): Promise<boolean> {
		return this.run("migrate_legacy_state");
	}
}

let nativeAppImpl: NativeDesktopApi | null = null;

function createNativeDesktopApi(): NativeDesktopApi {
	if (isTauriRuntime()) {
		return new TauriNativeDesktopApi();
	}
	return new MemoryNativeDesktopApi();
}

export function getNativeDesktopApi(): NativeDesktopApi {
	nativeAppImpl ??= createNativeDesktopApi();
	return nativeAppImpl;
}

export function setNativeDesktopApiForTests(api: NativeDesktopApi): void {
	nativeAppImpl = api;
}

export function resetNativeDesktopApiForTests(): void {
	nativeAppImpl = null;
}

export const nativeApp = new Proxy({} as NativeDesktopApi, {
	get(_target, property) {
		return Reflect.get(getNativeDesktopApi(), property);
	},
});
