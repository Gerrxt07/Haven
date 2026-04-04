export type ApiErrorKind =
	| "network"
	| "timeout"
	| "aborted"
	| "unauthorized"
	| "forbidden"
	| "not-found"
	| "conflict"
	| "validation"
	| "bad-request"
	| "server"
	| "unknown";

export type ApiError = {
	kind: ApiErrorKind;
	status?: number;
	message: string;
	code?: string;
	details?: unknown;
};

export type AuthTokens = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in_seconds: number;
};

export type RegisterRequest = {
	username: string;
	display_name: string;
	email: string;
	password: string;
	date_of_birth: string;
	locale: string;
};

export type AuthUserResponse = {
	id: number;
	username: string;
	display_name: string;
	email: string;
	avatar_url?: string | null;
	profile_image_url?: string | null;
	profile_picture_url?: string | null;
	profile_picture?: string | null;
	image_url?: string | null;
	photo_url?: string | null;
	avatarUrl?: string | null;
	profilePictureUrl?: string | null;
	avatar?: string | null;
	account_status: string;
	token_version: number;
	created_at: string;
};

export type LoginRequest = {
	email: string;
	password: string;
};

export type RefreshRequest = {
	refresh_token: string;
};

export type ServerDto = {
	id: number;
	owner_user_id: number;
	name: string;
	slug: string;
	description?: string | null;
	icon_url?: string | null;
	is_public: boolean;
	created_at: string;
	updated_at: string;
};

export type ChannelDto = {
	id: number;
	server_id: number;
	name: string;
	topic?: string | null;
	channel_type: string;
	position: number;
	is_private: boolean;
	created_at: string;
	updated_at: string;
};

export type MessageDto = {
	id: number;
	channel_id: number;
	author_user_id: number;
	author_avatar_url?: string | null;
	content: string;
	is_encrypted: boolean;
	ciphertext?: string | null;
	nonce?: string | null;
	aad?: string | null;
	algorithm?: string | null;
	edited_at?: string | null;
	deleted_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type PresenceEvent = {
	event_type: string;
	user_id?: number;
	channel?: string;
	payload: Record<string, unknown>;
	ts: number;
};

export type RealtimeConnectionState =
	| "idle"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "error";

export type CreateServerRequestDto = {
	name: string;
	slug: string;
	owner_user_id: number;
	description?: string;
	icon_url?: string;
	is_public?: boolean;
};

export type CreateChannelRequestDto = {
	server_id: number;
	actor_user_id: number;
	name: string;
	topic?: string;
	channel_type?: "text" | "voice" | "announcement";
	position?: number;
	is_private?: boolean;
};

export type CreateMessageRequestDto = {
	channel_id: number;
	author_user_id: number;
	content?: string;
	ciphertext?: string;
	nonce?: string;
	aad?: string;
	algorithm?: string;
	recipient_key_boxes?: Array<{
		recipient_user_id: number;
		encrypted_message_key: string;
		one_time_prekey_id?: number;
	}>;
};

export type E2eePublicBundle = {
	user_id: number;
	identity_key: string;
	signed_prekey_id: number;
	signed_prekey: string;
	signed_prekey_signature: string;
};

export type E2eeClaimedBundle = E2eePublicBundle & {
	one_time_prekey_id: number;
	one_time_prekey: string;
};
