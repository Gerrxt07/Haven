import { createIdempotencyKey } from "./idempotency";
import { apiClient } from "./index";
import type {
	ChannelDto,
	CreateChannelRequestDto,
	CreateMessageRequestDto,
	CreateServerRequestDto,
	MessageDto,
	ServerDto,
} from "./models";
import {
	assertChannelDto,
	assertCreateChannelRequest,
	assertCreateMessageRequest,
	assertCreateServerRequest,
	assertMessageDto,
	assertMessageDtoList,
	assertServerDto,
} from "./validation";

export async function apiCreateServer(
	payload: CreateServerRequestDto,
	signal?: AbortSignal,
): Promise<ServerDto> {
	assertCreateServerRequest(payload);
	const response = await apiClient.post<CreateServerRequestDto, ServerDto>(
		"/servers",
		payload,
		{
			signal,
			requiresAuth: true,
			idempotencyKey: createIdempotencyKey("create-server"),
		},
	);
	assertServerDto(response);
	return response;
}

export async function apiCreateChannel(
	payload: CreateChannelRequestDto,
	signal?: AbortSignal,
): Promise<ChannelDto> {
	assertCreateChannelRequest(payload);
	const response = await apiClient.post<CreateChannelRequestDto, ChannelDto>(
		"/channels",
		payload,
		{
			signal,
			requiresAuth: true,
			idempotencyKey: createIdempotencyKey("create-channel"),
		},
	);
	assertChannelDto(response);
	return response;
}

export async function apiCreateMessage(
	payload: CreateMessageRequestDto,
	signal?: AbortSignal,
): Promise<MessageDto> {
	assertCreateMessageRequest(payload);
	const response = await apiClient.post<CreateMessageRequestDto, MessageDto>(
		"/messages",
		payload,
		{
			signal,
			requiresAuth: true,
			idempotencyKey: createIdempotencyKey("create-message"),
		},
	);
	assertMessageDto(response);
	return response;
}

export async function apiListMessages(params: {
	channelId: number;
	before?: number;
	limit?: number;
	signal?: AbortSignal;
}): Promise<MessageDto[]> {
	const search = new URLSearchParams();
	if (params.before !== undefined) {
		search.set("before", String(params.before));
	}
	if (params.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	const query = search.toString();

	const response = await apiClient.get<MessageDto[]>(
		`/channels/${params.channelId}/messages${query ? `?${query}` : ""}`,
		{
			signal: params.signal,
			requiresAuth: true,
		},
	);
	assertMessageDtoList(response);
	return response;
}
