import { apiClient } from "./index";
import type {
	AuthTokens,
	AuthUserResponse,
	LoginRequest,
	RefreshRequest,
	RegisterRequest,
} from "./models";

export async function apiRegister(
	payload: RegisterRequest,
	signal?: AbortSignal,
): Promise<AuthUserResponse> {
	return apiClient.post<RegisterRequest, AuthUserResponse>(
		"/auth/register",
		payload,
		{
			signal,
		},
	);
}

export async function apiLogin(
	payload: LoginRequest,
	signal?: AbortSignal,
): Promise<AuthTokens> {
	return apiClient.post<LoginRequest, AuthTokens>("/auth/login", payload, {
		signal,
	});
}

export async function apiRefresh(
	payload: RefreshRequest,
	signal?: AbortSignal,
): Promise<AuthTokens> {
	return apiClient.post<RefreshRequest, AuthTokens>("/auth/refresh", payload, {
		signal,
	});
}

export async function apiMe(signal?: AbortSignal): Promise<AuthUserResponse> {
	return apiClient.get<AuthUserResponse>("/auth/me", {
		requiresAuth: true,
		signal,
	});
}
