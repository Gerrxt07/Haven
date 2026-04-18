import { writeDetailedErrorLog, writeDetailedLog } from "../logging/detailed";
import { apiClient } from "./index";
import type {
	AuthTokens,
	AuthUserResponse,
	EmailVerificationConfirmRequest,
	EmailVerificationRequest,
	LoginChallengeRequest,
	LoginChallengeResponse,
	LoginRequest,
	LoginVerifyRequest,
	LoginVerifyResponse,
	RefreshRequest,
	RegisterRequest,
	StatusResponse,
} from "./models";
import {
	assertAuthTokens,
	assertAuthUser,
	assertEmailVerificationConfirmRequest,
	assertEmailVerificationRequest,
	assertLoginChallengeRequest,
	assertLoginChallengeResponse,
	assertLoginRequest,
	assertLoginVerifyRequest,
	assertLoginVerifyResponse,
	assertRefreshRequest,
	assertRegisterRequest,
	assertStatusResponse,
} from "./validation";

const PROFILE_PICTURE_UPLOAD_PATH = "/users/me/avatar";

function extractAuthUserFromUploadResponse(
	value: unknown,
): AuthUserResponse | null {
	const candidates: unknown[] = [];

	if (value !== undefined && value !== null) {
		candidates.push(value);
	}

	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		candidates.push(
			record.user,
			record.data,
			record.profile,
			record.result,
			record.payload,
		);
	}

	for (const candidate of candidates) {
		try {
			assertAuthUser(candidate);
			return candidate;
		} catch {
			// Try the next shape.
		}
	}

	return null;
}

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

/// Step 1 of SRP login: Request challenge from server
export async function apiLoginChallenge(
	payload: LoginChallengeRequest,
	signal?: AbortSignal,
): Promise<LoginChallengeResponse> {
	assertLoginChallengeRequest(payload);
	const response = await apiClient.post<
		LoginChallengeRequest,
		LoginChallengeResponse
	>("/auth/login/challenge", payload, {
		signal,
	});
	assertLoginChallengeResponse(response);
	return response;
}

/// Step 2 of SRP login: Verify client proof and get tokens
export async function apiLoginVerify(
	payload: LoginVerifyRequest,
	challengeId: string,
	signal?: AbortSignal,
): Promise<LoginVerifyResponse> {
	assertLoginVerifyRequest(payload);
	if (challengeId.trim().length === 0) {
		throw new Error("invalid x-srp-challenge-id");
	}
	const response = await apiClient.post<
		LoginVerifyRequest,
		LoginVerifyResponse
	>("/auth/login/verify", payload, {
		signal,
		headers: {
			"x-srp-challenge-id": challengeId.trim(),
		},
	});
	assertLoginVerifyResponse(response);
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
		const response = await apiClient.request<unknown>(
			"POST",
			PROFILE_PICTURE_UPLOAD_PATH,
			formData,
			{
				requiresAuth: true,
				signal,
			},
		);

		const resolvedUser =
			extractAuthUserFromUploadResponse(response) ?? (await apiMe(signal));
		assertAuthUser(resolvedUser);
		await writeDetailedLog("avatar-upload", "api-request-success", {
			traceId: context?.traceId ?? null,
			userId: context?.userId ?? null,
			endpoint: PROFILE_PICTURE_UPLOAD_PATH,
			responseUserId: resolvedUser.id,
			hasAvatarUrl: Boolean(
				resolvedUser.avatar_url ??
					resolvedUser.profile_image_url ??
					resolvedUser.profile_picture_url ??
					resolvedUser.avatar,
			),
		});
		return resolvedUser;
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
