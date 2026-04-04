import { HttpApiError } from "./client";
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

const PROFILE_PICTURE_UPLOAD_PATHS = [
	"/auth/me/profile-picture",
	"/auth/me/avatar",
	"/users/me/avatar",
	"/auth/profile-picture",
];

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
	if (!file.type.startsWith("image/")) {
		throw new Error("profile image must be an image file");
	}

	const formData = new FormData();
	formData.set("file", file);
	formData.set("profile_picture", file);
	formData.set("avatar", file);

	for (const path of PROFILE_PICTURE_UPLOAD_PATHS) {
		try {
			const response = await apiClient.request<AuthUserResponse>(
				"POST",
				path,
				formData,
				{
					requiresAuth: true,
					signal,
				},
			);
			assertAuthUser(response);
			return response;
		} catch (error) {
			const isLastPath =
				path ===
				PROFILE_PICTURE_UPLOAD_PATHS[PROFILE_PICTURE_UPLOAD_PATHS.length - 1];

			if (error instanceof HttpApiError) {
				const shouldTryNextPath =
					error.apiError.kind === "not-found" ||
					error.apiError.kind === "bad-request" ||
					error.apiError.kind === "validation";

				if (shouldTryNextPath && !isLastPath) {
					continue;
				}

				throw error;
			}

			if (error instanceof Error && !isLastPath) {
				continue;
			}
			throw error;
		}
	}

	throw new Error("Unable to upload profile picture");
}
