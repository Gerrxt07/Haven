import {
	type AuthTokens,
	type AuthUserResponse,
	apiClient,
	apiConfirmEmailVerification,
	apiLogin,
	apiLoginChallenge,
	apiLoginVerify,
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
	cleanupSrpState,
	computeClientProof,
	generateSalt,
	generateVerifier,
	initSrpLogin,
	verifyServerProof,
	type SrpLoginState,
} from "./srp";
import {
	cacheProfileImageDataUrl,
	clearCachedProfileImage,
	fileToImageDataUrl,
	primeRelatedUserAvatar,
} from "../cache/profile-images";
import { writeDetailedErrorLog, writeDetailedLog } from "../logging/detailed";

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

	async register(
		payload: Omit<RegisterRequest, "srp_salt" | "srp_verifier"> & { password: string },
	): Promise<AuthUserResponse> {
		// Generate SRP salt and verifier locally
		const salt = generateSalt();
		const verifier = generateVerifier(payload.email, payload.password, salt);

		// Clear password from memory (best effort)
		payload.password = "";

		const srpPayload: RegisterRequest = {
			username: payload.username,
			display_name: payload.display_name,
			email: payload.email,
			srp_salt: salt,
			srp_verifier: verifier,
			date_of_birth: payload.date_of_birth,
			locale: payload.locale,
		};

		return apiRegister(srpPayload);
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

	/// Legacy login using password (for backward compatibility)
	async login(payload: LoginRequest): Promise<AuthUserResponse> {
		const tokens = await apiLogin(payload);
		await this.persistTokens(tokens);
		this.state.currentUser = await apiMe();
		this.notify();
		return this.state.currentUser;
	}

	/// SRP login using 2-step challenge-response handshake
	async loginWithSRP(
		email: string,
		password: string,
		totpCode?: string,
		backupCode?: string,
	): Promise<AuthUserResponse> {
		// Step 0: Initialize SRP client ephemeral keys
		const srpState: SrpLoginState = initSrpLogin(email, password);

		try {
			// Step 1: Send email to server to get challenge (salt + server public key B)
			const challengeResponse = await apiLoginChallenge({ email });

			// Step 2: Compute client proof M1 using the password (client-side only)
			const challengeWithId = {
				challengeId: challengeResponse.challenge_id,
				srp_salt: challengeResponse.srp_salt,
				server_public_key_b: challengeResponse.server_public_key_b,
			};

			const clientProof = computeClientProof(srpState, challengeWithId);

			// Clear password from memory immediately after computing proof
			cleanupSrpState(srpState);

			// Step 3: Send client public key A and proof M1 to server
			const verifyResponse = await apiLoginVerify(
				{
					email,
					client_public_key_a: clientProof.clientPublicKeyA,
					client_proof_m1: clientProof.clientProofM1,
				},
				challengeResponse.challenge_id,
			);

			// Step 4: Verify server proof M2
			const isServerVerified = verifyServerProof(srpState, verifyResponse.server_proof_m2);
			if (!isServerVerified) {
				throw new Error("Server authentication failed - possible man-in-the-middle attack");
			}

			// Extract tokens from verify response
			const tokens: AuthTokens = {
				access_token: verifyResponse.access_token,
				refresh_token: verifyResponse.refresh_token,
				token_type: verifyResponse.token_type,
				expires_in_seconds: verifyResponse.expires_in_seconds,
			};

			await this.persistTokens(tokens);
			this.state.currentUser = await apiMe();
			this.notify();
			return this.state.currentUser;
		} catch (error) {
			// Clean up SRP state on error
			cleanupSrpState(srpState);
			throw error;
		}
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
