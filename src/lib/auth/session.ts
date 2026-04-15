import {
	type AuthTokens,
	type AuthUserResponse,
	apiClient,
	apiConfirmEmailVerification,
	apiLogin,
	apiMe,
	apiRefresh,
	apiRegister,
	apiRequestEmailVerification,
	apiUploadProfilePicture,
	type EmailVerificationConfirmRequest,
	type EmailVerificationRequest,
	HttpApiError,
	type LoginRequest,
	type RegisterRequest,
	type StatusResponse,
} from "../api";
import {
	cacheProfileImageDataUrl,
	clearCachedProfileImage,
	fileToImageDataUrl,
	primeRelatedUserAvatar,
} from "../cache/profile-images";
import { writeDetailedErrorLog, writeDetailedLog } from "../logging/detailed";
import { nativeApp } from "../native";

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
		await nativeApp.migrateLegacyState();

		const [legacyToken, accessToken, refreshToken] = await Promise.all([
			nativeApp.loadToken(),
			nativeApp.secureStoreGet(TOKEN_NAMESPACE, ACCESS_TOKEN_KEY),
			nativeApp.secureStoreGet(TOKEN_NAMESPACE, REFRESH_TOKEN_KEY),
		]);

		this.state.accessToken = accessToken ?? legacyToken;
		this.state.refreshToken = refreshToken;
		this.notify();

		if (legacyToken && accessToken !== legacyToken) {
			await nativeApp.deleteToken();
		}

		if (!this.state.accessToken && this.state.refreshToken) {
			const refreshed = await this.refreshAccessToken({
				invalidateOnFailure: false,
			});
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
				// Keep persisted credentials and retry later instead of force-logging out
				// on transient startup failures (network/timeout/backend unavailable).
			}
		}

		this.state.isReady = true;
		this.notify();
	}

	async register(payload: RegisterRequest): Promise<AuthUserResponse> {
		return apiRegister(payload);
	}

	async requestEmailVerification(
		payload: EmailVerificationRequest,
	): Promise<StatusResponse> {
		return apiRequestEmailVerification(payload);
	}

	async confirmEmailVerification(
		payload: EmailVerificationConfirmRequest,
	): Promise<StatusResponse> {
		return apiConfirmEmailVerification(payload);
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

		await Promise.all([
			nativeApp.deleteToken(),
			nativeApp.secureStoreDelete(TOKEN_NAMESPACE, ACCESS_TOKEN_KEY),
			nativeApp.secureStoreDelete(TOKEN_NAMESPACE, REFRESH_TOKEN_KEY),
		]);
	}

	async uploadProfilePicture(file: File): Promise<AuthUserResponse> {
		if (!this.state.currentUser) {
			throw new Error("Cannot upload a profile picture without an active user");
		}

		const currentUserId = this.state.currentUser.id;
		const traceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
		const previousUser = this.state.currentUser;
		await writeDetailedLog("avatar-upload", "session-upload-start", {
			traceId,
			userId: currentUserId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			hasExistingAvatar: Boolean(
				previousUser.avatar_url ??
					previousUser.profile_image_url ??
					previousUser.profile_picture_url ??
					previousUser.avatar,
			),
		});
		const previewDataUrl = await fileToImageDataUrl(file);
		await cacheProfileImageDataUrl(
			currentUserId,
			previewDataUrl,
			"local-upload",
		);
		await writeDetailedLog("avatar-upload", "session-preview-cached", {
			traceId,
			userId: currentUserId,
			previewLength: previewDataUrl.length,
		});
		this.notify();

		try {
			const updatedUser = await apiUploadProfilePicture(file, undefined, {
				traceId,
				userId: currentUserId,
			});
			this.state.currentUser = updatedUser;
			this.notify();
			await writeDetailedLog("avatar-upload", "session-user-updated", {
				traceId,
				userId: currentUserId,
				responseUserId: updatedUser.id,
				avatarUrl:
					updatedUser.avatar_url ??
					updatedUser.profile_image_url ??
					updatedUser.profile_picture_url ??
					updatedUser.avatar ??
					null,
			});

			await primeRelatedUserAvatar(
				updatedUser.id,
				updatedUser.avatar_url ??
					updatedUser.profile_image_url ??
					updatedUser.profile_picture_url ??
					updatedUser.avatar ??
					null,
			);
			await writeDetailedLog("avatar-upload", "session-avatar-cache-primed", {
				traceId,
				userId: updatedUser.id,
			});

			return updatedUser;
		} catch (error) {
			await clearCachedProfileImage(currentUserId);
			this.state.currentUser = previousUser;
			this.notify();
			await writeDetailedErrorLog(
				"avatar-upload",
				"session-upload-failed",
				error,
				{
					traceId,
					userId: currentUserId,
				},
			);
			throw error;
		}
	}

	async refreshAccessToken(options?: {
		invalidateOnFailure?: boolean;
	}): Promise<boolean> {
		if (this.refreshInFlight) {
			return this.refreshInFlight;
		}

		const invalidateOnFailure = options?.invalidateOnFailure ?? true;

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
			} catch (error) {
				const shouldInvalidate =
					this.shouldInvalidateSessionOnRefreshError(error) ||
					(invalidateOnFailure &&
						!this.shouldPreserveSessionOnRefreshError(error));

				if (shouldInvalidate) {
					await this.logout();
				}
				return false;
			}
		})();

		try {
			return await this.refreshInFlight;
		} finally {
			this.refreshInFlight = null;
		}
	}

	private shouldInvalidateSessionOnRefreshError(error: unknown): boolean {
		if (!(error instanceof HttpApiError)) {
			return false;
		}

		return (
			error.apiError.kind === "unauthorized" ||
			error.apiError.kind === "forbidden" ||
			error.apiError.kind === "bad-request" ||
			error.apiError.kind === "validation"
		);
	}

	private shouldPreserveSessionOnRefreshError(error: unknown): boolean {
		if (!(error instanceof HttpApiError)) {
			return true;
		}

		return (
			error.apiError.kind === "network" ||
			error.apiError.kind === "timeout" ||
			error.apiError.kind === "aborted" ||
			error.apiError.kind === "server" ||
			error.apiError.kind === "unknown"
		);
	}

	private async persistTokens(tokens: AuthTokens): Promise<void> {
		this.state.accessToken = tokens.access_token;
		this.state.refreshToken = tokens.refresh_token;
		this.notify();

		await Promise.all([
			nativeApp.storeToken(tokens.access_token),
			nativeApp.secureStoreSet(
				TOKEN_NAMESPACE,
				ACCESS_TOKEN_KEY,
				tokens.access_token,
			),
			nativeApp.secureStoreSet(
				TOKEN_NAMESPACE,
				REFRESH_TOKEN_KEY,
				tokens.refresh_token,
			),
		]);
	}
}

export const authSession = new AuthSessionManager();
