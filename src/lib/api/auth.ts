import { writeDetailedErrorLog, writeDetailedLog } from "../logging/detailed";
import { apiClient } from "./index";
import type {
	AuthTokens,
	AuthUserResponse,
	EmailVerificationConfirmRequest,
	EmailVerificationRequest,
	LoginRequest,
	RefreshRequest,
	RegisterRequest,
	StatusResponse,
} from "./models";
import {
	assertAuthTokens,
	assertAuthUser,
	assertEmailVerificationConfirmRequest,
	assertEmailVerificationRequest,
	assertLoginRequest,
	assertRefreshRequest,
	assertRegisterRequest,
	assertStatusResponse,
} from "./validation";

const PROFILE_PICTURE_UPLOAD_PATH = "/users/me/avatar";

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

export async function apiRequestEmailVerification(
	payload: EmailVerificationRequest,
	signal?: AbortSignal,
): Promise<StatusResponse> {
	assertEmailVerificationRequest(payload);
	const response = await apiClient.post<
		EmailVerificationRequest,
		StatusResponse
	>("/auth/email/verification/request", payload, {
		signal,
	});
	assertStatusResponse(response);
	return response;
}

export async function apiConfirmEmailVerification(
	payload: EmailVerificationConfirmRequest,
	signal?: AbortSignal,
): Promise<StatusResponse> {
	assertEmailVerificationConfirmRequest(payload);
	const response = await apiClient.post<
		EmailVerificationConfirmRequest,
		StatusResponse
	>("/auth/email/verification/confirm", payload, {
		signal,
	});
	assertStatusResponse(response);
	return response;
}

export async function apiUploadProfilePicture(
	file: File,
	signal?: AbortSignal,
	context?: {
		traceId?: string;
		userId?: number;
	},
): Promise<AuthUserResponse> {
	if (!file.type.startsWith("image/")) {
		throw new Error("profile image must be an image file");
	}

	const formData = new FormData();
	formData.set("file", file);
	formData.set("profile_picture", file);
	formData.set("avatar", file);

	await writeDetailedLog("avatar-upload", "api-request-start", {
		traceId: context?.traceId ?? null,
		userId: context?.userId ?? null,
		endpoint: PROFILE_PICTURE_UPLOAD_PATH,
		fileName: file.name,
		fileType: file.type,
		fileSize: file.size,
		formFields: ["file", "profile_picture", "avatar"],
	});

	try {
		const response = await apiClient.request<AuthUserResponse>(
			"POST",
			PROFILE_PICTURE_UPLOAD_PATH,
			formData,
			{
				requiresAuth: true,
				signal,
			},
		);
		assertAuthUser(response);
		await writeDetailedLog("avatar-upload", "api-request-success", {
			traceId: context?.traceId ?? null,
			userId: context?.userId ?? null,
			endpoint: PROFILE_PICTURE_UPLOAD_PATH,
			responseUserId: response.id,
			hasAvatarUrl: Boolean(
				response.avatar_url ??
					response.profile_image_url ??
					response.profile_picture_url ??
					response.avatar,
			),
		});
		return response;
	} catch (error) {
		await writeDetailedErrorLog("avatar-upload", "api-request-failed", error, {
			traceId: context?.traceId ?? null,
			userId: context?.userId ?? null,
			endpoint: PROFILE_PICTURE_UPLOAD_PATH,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
		});
		throw error;
	}
}
