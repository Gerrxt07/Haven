import { apiClient } from "./index";
import type {
	ChannelDto,
	CreateChannelRequestDto,
	CreateMessageRequestDto,
	CreateServerRequestDto,
	MessageDto,
	ServerDto,
} from "./models";

export async function apiCreateServer(
	payload: CreateServerRequestDto,
	signal?: AbortSignal,
): Promise<ServerDto> {
	return apiClient.post<CreateServerRequestDto, ServerDto>(
		"/servers",
		payload,
		{
			signal,
			requiresAuth: true,
		},
	);
}

export async function apiCreateChannel(
	payload: CreateChannelRequestDto,
	signal?: AbortSignal,
): Promise<ChannelDto> {
	return apiClient.post<CreateChannelRequestDto, ChannelDto>(
		"/channels",
		payload,
		{
			signal,
			requiresAuth: true,
		},
	);
}

export async function apiCreateMessage(
	payload: CreateMessageRequestDto,
	signal?: AbortSignal,
): Promise<MessageDto> {
	return apiClient.post<CreateMessageRequestDto, MessageDto>(
		"/messages",
		payload,
		{
			signal,
			requiresAuth: true,
		},
	);
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

	return apiClient.get<MessageDto[]>(
		`/channels/${params.channelId}/messages${query ? `?${query}` : ""}`,
		{
			signal: params.signal,
			requiresAuth: true,
		},
	);
}
