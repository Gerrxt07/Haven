import { apiClient } from "./index";
import type {
	FriendDto,
	FriendRequestDto,
	SendFriendRequestDto,
} from "./models";
import {
	assertFriendDtoList,
	assertFriendRequestDto,
	assertFriendRequestDtoList,
	assertSendFriendRequest,
} from "./validation";

export async function apiSendFriendRequest(
	payload: SendFriendRequestDto,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	assertSendFriendRequest(payload);
	const response = await apiClient.post<SendFriendRequestDto, FriendRequestDto>(
		"/friends/request",
		payload,
		{
			signal,
			requiresAuth: true,
		},
	);
	assertFriendRequestDto(response);
	return response;
}

export async function apiGetIncomingFriendRequests(
	signal?: AbortSignal,
): Promise<FriendRequestDto[]> {
	const response = await apiClient.get<FriendRequestDto[]>(
		"/friends/requests/incoming",
		{
			signal,
			requiresAuth: true,
		},
	);
	assertFriendRequestDtoList(response);
	return response;
}

export async function apiGetOutgoingFriendRequests(
	signal?: AbortSignal,
): Promise<FriendRequestDto[]> {
	const response = await apiClient.get<FriendRequestDto[]>(
		"/friends/requests/outgoing",
		{
			signal,
			requiresAuth: true,
		},
	);
	assertFriendRequestDtoList(response);
	return response;
}

export async function apiAcceptFriendRequest(
	requestId: number,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	const response = await apiClient.post<
		Record<string, never>,
		FriendRequestDto
	>(
		`/friends/requests/${requestId}/accept`,
		{},
		{
			signal,
			requiresAuth: true,
		},
	);
	assertFriendRequestDto(response);
	return response;
}

export async function apiDeclineFriendRequest(
	requestId: number,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	const response = await apiClient.post<
		Record<string, never>,
		FriendRequestDto
	>(
		`/friends/requests/${requestId}/decline`,
		{},
		{
			signal,
			requiresAuth: true,
		},
	);
	assertFriendRequestDto(response);
	return response;
}

export async function apiGetFriends(
	signal?: AbortSignal,
): Promise<FriendDto[]> {
	const response = await apiClient.get<FriendDto[]>("/friends", {
		signal,
		requiresAuth: true,
	});
	assertFriendDtoList(response);
	return response;
}
