import { apiClient } from "./index";
import type {
	AuthTokens,
	AuthUserResponse,
	LoginRequest,
	RefreshRequest,
	RegisterRequest,
} from "./models";
import {
	assertAuthTokens,
	assertAuthUser,
	assertLoginRequest,
	assertRefreshRequest,
	assertRegisterRequest,
} from "./validation";

export async function apiRegister(
	payload: RegisterRequest,
	signal?: AbortSignal,
): Promise<AuthUserResponse> {
	assertRegisterRequest(payload);
	const response = await apiClient.post<RegisterRequest, AuthUserResponse>(
		"/auth/register",
		payload,
		{
			signal,
		},
	);
	assertAuthUser(response);
	return response;
}

export async function apiLogin(
	payload: LoginRequest,
	signal?: AbortSignal,
): Promise<AuthTokens> {
	assertLoginRequest(payload);
	const response = await apiClient.post<LoginRequest, AuthTokens>(
		"/auth/login",
		payload,
		{
			signal,
		},
	);
	assertAuthTokens(response);
	return response;
}

export async function apiRefresh(
	payload: RefreshRequest,
	signal?: AbortSignal,
): Promise<AuthTokens> {
	assertRefreshRequest(payload);
	const response = await apiClient.post<RefreshRequest, AuthTokens>(
		"/auth/refresh",
		payload,
		{
			signal,
		},
	);
	assertAuthTokens(response);
	return response;
}

export async function apiMe(signal?: AbortSignal): Promise<AuthUserResponse> {
	const response = await apiClient.get<AuthUserResponse>("/auth/me", {
		requiresAuth: true,
		signal,
	});
	assertAuthUser(response);
	return response;
}
