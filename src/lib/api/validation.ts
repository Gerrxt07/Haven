import type {
	AuthTokens,
	AuthUserResponse,
	AvatarUploadResponse,
	ChannelDto,
	CreateChannelRequestDto,
	CreateMessageRequestDto,
	CreateServerRequestDto,
	LoginRequest,
	MessageDto,
	RefreshRequest,
	RegisterRequest,
	ServerDto,
} from "./models";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object";
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function assertRegisterRequest(payload: RegisterRequest): void {
	assert(payload.username.trim().length >= 3, "invalid username");
	assert(payload.display_name.trim().length >= 1, "invalid display_name");
	assert(payload.email.includes("@"), "invalid email");
	assert(payload.password.length >= 8, "invalid password");
	assert(payload.date_of_birth.length > 0, "invalid date_of_birth");
	assert(payload.locale.length > 0, "invalid locale");
}

export function assertLoginRequest(payload: LoginRequest): void {
	assert(payload.email.includes("@"), "invalid email");
	assert(payload.password.length > 0, "invalid password");
}

export function assertRefreshRequest(payload: RefreshRequest): void {
	assert(payload.refresh_token.length > 0, "invalid refresh token");
}

export function assertAuthTokens(value: unknown): asserts value is AuthTokens {
	assert(isObject(value), "invalid auth tokens response");
	assert(isString(value.access_token), "missing access_token");
	assert(isString(value.refresh_token), "missing refresh_token");
	assert(isString(value.token_type), "missing token_type");
	assert(isNumber(value.expires_in_seconds), "missing expires_in_seconds");
}

export function assertAuthUser(
	value: unknown,
): asserts value is AuthUserResponse {
	assert(isObject(value), "invalid auth user response");
	assert(isNumber(value.id), "missing id");
	assert(isString(value.username), "missing username");
	assert(isString(value.display_name), "missing display_name");
	assert(isString(value.email), "missing email");
	if (value.avatar_url !== undefined && value.avatar_url !== null) {
		assert(isString(value.avatar_url), "invalid avatar_url");
	}
	if (
		value.profile_image_url !== undefined &&
		value.profile_image_url !== null
	) {
		assert(isString(value.profile_image_url), "invalid profile_image_url");
	}
	if (
		value.profile_picture_url !== undefined &&
		value.profile_picture_url !== null
	) {
		assert(isString(value.profile_picture_url), "invalid profile_picture_url");
	}
	if (value.avatar !== undefined && value.avatar !== null) {
		assert(isString(value.avatar), "invalid avatar");
	}
	if (value.profile_picture !== undefined && value.profile_picture !== null) {
		assert(isString(value.profile_picture), "invalid profile_picture");
	}
	if (value.image_url !== undefined && value.image_url !== null) {
		assert(isString(value.image_url), "invalid image_url");
	}
	if (value.photo_url !== undefined && value.photo_url !== null) {
		assert(isString(value.photo_url), "invalid photo_url");
	}
	if (value.avatarUrl !== undefined && value.avatarUrl !== null) {
		assert(isString(value.avatarUrl), "invalid avatarUrl");
	}
	if (
		value.profilePictureUrl !== undefined &&
		value.profilePictureUrl !== null
	) {
		assert(isString(value.profilePictureUrl), "invalid profilePictureUrl");
	}
	assert(isString(value.account_status), "missing account_status");
	assert(isNumber(value.token_version), "missing token_version");
	assert(isString(value.created_at), "missing created_at");
}

export function assertAvatarUploadResponse(
	value: unknown,
): asserts value is AvatarUploadResponse {
	assert(isObject(value), "invalid avatar upload response");
	assert(isString(value.avatar_url), "missing avatar_url");
	assert(isNumber(value.width), "missing width");
	assert(isNumber(value.height), "missing height");
	assert(isNumber(value.size_bytes), "missing size_bytes");
	assert(isString(value.format), "missing format");
}

export function assertCreateServerRequest(
	payload: CreateServerRequestDto,
): void {
	assert(payload.name.trim().length >= 2, "invalid server name");
	assert(payload.slug.trim().length >= 2, "invalid server slug");
	assert(isNumber(payload.owner_user_id), "invalid owner_user_id");
}

export function assertCreateChannelRequest(
	payload: CreateChannelRequestDto,
): void {
	assert(isNumber(payload.server_id), "invalid server_id");
	assert(isNumber(payload.actor_user_id), "invalid actor_user_id");
	assert(payload.name.trim().length >= 1, "invalid channel name");
}

export function assertCreateMessageRequest(
	payload: CreateMessageRequestDto,
): void {
	assert(isNumber(payload.channel_id), "invalid channel_id");
	assert(isNumber(payload.author_user_id), "invalid author_user_id");
	const hasPlainContent =
		typeof payload.content === "string" && payload.content.length > 0;
	const hasCipherContent =
		typeof payload.ciphertext === "string" &&
		typeof payload.nonce === "string" &&
		typeof payload.algorithm === "string";
	assert(
		hasPlainContent || hasCipherContent,
		"message requires plaintext or ciphertext payload",
	);
}

export function assertServerDto(value: unknown): asserts value is ServerDto {
	assert(isObject(value), "invalid server response");
	assert(isNumber(value.id), "missing server.id");
	assert(isNumber(value.owner_user_id), "missing server.owner_user_id");
	assert(isString(value.name), "missing server.name");
	assert(isString(value.slug), "missing server.slug");
	assert(isString(value.created_at), "missing server.created_at");
	assert(isString(value.updated_at), "missing server.updated_at");
}

export function assertChannelDto(value: unknown): asserts value is ChannelDto {
	assert(isObject(value), "invalid channel response");
	assert(isNumber(value.id), "missing channel.id");
	assert(isNumber(value.server_id), "missing channel.server_id");
	assert(isString(value.name), "missing channel.name");
	assert(isString(value.channel_type), "missing channel.channel_type");
	assert(isNumber(value.position), "missing channel.position");
	assert(typeof value.is_private === "boolean", "missing channel.is_private");
	assert(isString(value.created_at), "missing channel.created_at");
	assert(isString(value.updated_at), "missing channel.updated_at");
}

export function assertMessageDto(value: unknown): asserts value is MessageDto {
	assert(isObject(value), "invalid message response");
	assert(isNumber(value.id), "missing message.id");
	assert(isNumber(value.channel_id), "missing message.channel_id");
	assert(isNumber(value.author_user_id), "missing message.author_user_id");
	assert(isString(value.content), "missing message.content");
	assert(
		typeof value.is_encrypted === "boolean",
		"missing message.is_encrypted",
	);
	assert(isString(value.created_at), "missing message.created_at");
	assert(isString(value.updated_at), "missing message.updated_at");
}

export function assertMessageDtoList(
	value: unknown,
): asserts value is MessageDto[] {
	assert(Array.isArray(value), "invalid messages response");
	for (const entry of value) {
		assertMessageDto(entry);
	}
}
