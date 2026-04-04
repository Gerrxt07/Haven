import { apiClient } from "./index";
import type {
	AuthTokens,
	AuthUserResponse,
	AvatarUploadResponse,
	LoginRequest,
	RefreshRequest,
	RegisterRequest,
} from "./models";
import {
	assertAuthTokens,
	assertAuthUser,
	assertAvatarUploadResponse,
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

export async function apiUploadProfilePicture(
	file: File,
	signal?: AbortSignal,
): Promise<AuthUserResponse> {
	const allowedTypes = new Set(["image/jpeg", "image/png"]);
	if (!allowedTypes.has(file.type)) {
		throw new Error("avatar must be JPG or PNG");
	}
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("avatar must be <= 5MB");
	}

	const formData = new FormData();
	formData.append("file", file);

	const response = await apiClient.postFormData<AvatarUploadResponse>(
		"/users/me/avatar",
		formData,
		{
			requiresAuth: true,
			signal,
		},
	);

	assertAvatarUploadResponse(response);
	const user = await apiMe(signal);
	if (!user.avatar_url && response.avatar_url) {
		return {
			...user,
			avatar_url: response.avatar_url,
		};
	}
	return user;
}
