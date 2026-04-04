import {
	type AuthTokens,
	type AuthUserResponse,
	apiClient,
	apiLogin,
	apiMe,
	apiRefresh,
	apiRegister,
	apiUploadProfilePicture,
	type LoginRequest,
	type RegisterRequest,
} from "../api";
import {
	cacheProfileImageDataUrl,
	clearCachedProfileImage,
	fileToImageDataUrl,
	primeRelatedUserAvatar,
} from "../cache/profile-images";
import { safeInfo, safeWarn } from "../security/redaction";

const ACCESS_TOKEN_KEY = "token.access";
const REFRESH_TOKEN_KEY = "token.refresh";
const TOKEN_NAMESPACE = "auth";

type SessionState = {
	accessToken: string | null;
	refreshToken: string | null;
	currentUser: AuthUserResponse | null;
	isReady: boolean;
};

type SessionListener = (state: SessionState) => void;

class AuthSessionManager {
	private state: SessionState = {
		accessToken: null,
		refreshToken: null,
		currentUser: null,
		isReady: false,
	};

	private refreshInFlight: Promise<boolean> | null = null;
	private readonly listeners = new Set<SessionListener>();

	constructor() {
		apiClient.setTokenProvider(() => this.state.accessToken);
		apiClient.setRefreshHandler(async () => this.refreshAccessToken());
	}

	get accessToken(): string | null {
		return this.state.accessToken;
	}

	get refreshToken(): string | null {
		return this.state.refreshToken;
	}

	get currentUser(): AuthUserResponse | null {
		return this.state.currentUser;
	}

	snapshot(): SessionState {
		return { ...this.state };
	}

	onChange(listener: SessionListener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		const snapshot = this.snapshot();
		for (const listener of this.listeners) {
			listener(snapshot);
		}
	}

	async bootstrapFromStorage(): Promise<void> {
		if (!globalThis.electronAPI) {
			this.state.isReady = true;
			this.notify();
			return;
		}

		const [legacyToken, accessToken, refreshToken] = await Promise.all([
			globalThis.electronAPI.loadToken(),
			globalThis.electronAPI.secureStoreGet(TOKEN_NAMESPACE, ACCESS_TOKEN_KEY),
			globalThis.electronAPI.secureStoreGet(TOKEN_NAMESPACE, REFRESH_TOKEN_KEY),
		]);

		this.state.accessToken = accessToken ?? legacyToken;
		this.state.refreshToken = refreshToken;
		this.notify();

		if (legacyToken && accessToken !== legacyToken) {
			await globalThis.electronAPI.deleteToken();
		}

		if (!this.state.accessToken && this.state.refreshToken) {
			const refreshed = await this.refreshAccessToken();
			if (!refreshed) {
				this.state.isReady = true;
				this.notify();
				return;
			}
		}

		if (this.state.accessToken) {
			try {
				this.state.currentUser = await apiMe();
			} catch {
				const refreshed = await this.refreshAccessToken();
				if (refreshed) {
					this.state.currentUser = await apiMe();
				}
			}
		}

		this.state.isReady = true;
		this.notify();
	}

	async register(payload: RegisterRequest): Promise<AuthUserResponse> {
		return apiRegister(payload);
	}

	async login(payload: LoginRequest): Promise<AuthUserResponse> {
		const tokens = await apiLogin(payload);
		await this.persistTokens(tokens);
		this.state.currentUser = await apiMe();
		this.notify();
		return this.state.currentUser;
	}

	async logout(): Promise<void> {
		this.state = {
			accessToken: null,
			refreshToken: null,
			currentUser: null,
			isReady: true,
		};
		this.notify();

		if (!globalThis.electronAPI) {
			return;
		}

		await Promise.all([
			globalThis.electronAPI.deleteToken(),
			globalThis.electronAPI.secureStoreDelete(
				TOKEN_NAMESPACE,
				ACCESS_TOKEN_KEY,
			),
			globalThis.electronAPI.secureStoreDelete(
				TOKEN_NAMESPACE,
				REFRESH_TOKEN_KEY,
			),
		]);
	}

	async uploadProfilePicture(file: File): Promise<AuthUserResponse> {
		if (!this.state.currentUser) {
			throw new Error("Cannot upload a profile picture without an active user");
		}

		const currentUserId = this.state.currentUser.id;
		safeInfo("profile-picture upload started", {
			userId: currentUserId,
			fileType: file.type,
			fileSizeBytes: file.size,
		});
		const previousUser = this.state.currentUser;
		const previewDataUrl = await fileToImageDataUrl(file);
		await cacheProfileImageDataUrl(
			currentUserId,
			previewDataUrl,
			"local-upload",
		);
		safeInfo("profile-picture local preview cached", {
			userId: currentUserId,
		});
		this.notify();

		try {
			const updatedUser = await apiUploadProfilePicture(file);
			this.state.currentUser = updatedUser;
			safeInfo("profile-picture upload succeeded", {
				userId: updatedUser.id,
				hasAvatarUrl: Boolean(
					updatedUser.avatar_url ??
						updatedUser.profile_image_url ??
						updatedUser.profile_picture_url ??
						updatedUser.avatar,
				),
			});
			this.notify();

			await primeRelatedUserAvatar(
				updatedUser.id,
				updatedUser.avatar_url ??
					updatedUser.profile_image_url ??
					updatedUser.profile_picture_url ??
					updatedUser.avatar ??
					null,
			);

			return updatedUser;
		} catch (error) {
			safeWarn("profile-picture upload failed, reverting local preview", {
				userId: currentUserId,
				error: error instanceof Error ? error.message : "unknown upload error",
			});
			await clearCachedProfileImage(currentUserId);
			this.state.currentUser = previousUser;
			this.notify();
			throw error;
		}
	}

	async refreshAccessToken(): Promise<boolean> {
		if (this.refreshInFlight) {
			return this.refreshInFlight;
		}

		this.refreshInFlight = (async () => {
			if (!this.state.refreshToken) {
				return false;
			}

			try {
				const tokens = await apiRefresh({
					refresh_token: this.state.refreshToken,
				});
				await this.persistTokens(tokens);
				return true;
			} catch {
				await this.logout();
				return false;
			}
		})();

		try {
			return await this.refreshInFlight;
		} finally {
			this.refreshInFlight = null;
		}
	}

	private async persistTokens(tokens: AuthTokens): Promise<void> {
		this.state.accessToken = tokens.access_token;
		this.state.refreshToken = tokens.refresh_token;
		this.notify();

		if (!globalThis.electronAPI) {
			return;
		}

		await Promise.all([
			globalThis.electronAPI.storeToken(tokens.access_token),
			globalThis.electronAPI.secureStoreSet(
				TOKEN_NAMESPACE,
				ACCESS_TOKEN_KEY,
				tokens.access_token,
			),
			globalThis.electronAPI.secureStoreSet(
				TOKEN_NAMESPACE,
				REFRESH_TOKEN_KEY,
				tokens.refresh_token,
			),
		]);
	}
}

export const authSession = new AuthSessionManager();
