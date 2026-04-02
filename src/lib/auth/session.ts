import {
	type AuthTokens,
	type AuthUserResponse,
	apiClient,
	apiLogin,
	apiMe,
	apiRefresh,
	apiRegister,
	type LoginRequest,
	type RegisterRequest,
} from "../api";

const ACCESS_TOKEN_KEY = "token.access";
const REFRESH_TOKEN_KEY = "token.refresh";
const TOKEN_NAMESPACE = "auth";

type SessionState = {
	accessToken: string | null;
	refreshToken: string | null;
	currentUser: AuthUserResponse | null;
};

class AuthSessionManager {
	private state: SessionState = {
		accessToken: null,
		refreshToken: null,
		currentUser: null,
	};

	private refreshInFlight: Promise<boolean> | null = null;

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

	async bootstrapFromStorage(): Promise<void> {
		if (!globalThis.electronAPI) {
			return;
		}

		const [legacyToken, accessToken, refreshToken] = await Promise.all([
			globalThis.electronAPI.loadToken(),
			globalThis.electronAPI.secureStoreGet(TOKEN_NAMESPACE, ACCESS_TOKEN_KEY),
			globalThis.electronAPI.secureStoreGet(TOKEN_NAMESPACE, REFRESH_TOKEN_KEY),
		]);

		this.state.accessToken = accessToken ?? legacyToken;
		this.state.refreshToken = refreshToken;

		if (this.state.accessToken) {
			try {
				this.state.currentUser = await apiMe();
			} catch {
				await this.refreshAccessToken();
			}
		}
	}

	async register(payload: RegisterRequest): Promise<AuthUserResponse> {
		return apiRegister(payload);
	}

	async login(payload: LoginRequest): Promise<AuthUserResponse> {
		const tokens = await apiLogin(payload);
		await this.persistTokens(tokens);
		this.state.currentUser = await apiMe();
		return this.state.currentUser;
	}

	async logout(): Promise<void> {
		this.state = {
			accessToken: null,
			refreshToken: null,
			currentUser: null,
		};

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
