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

function quoteFriendRequestIds(raw: string): string {
	return raw.replace(/("id"\s*:\s*)(\d+)/g, '$1"$2"');
}

function parseFriendRequest(raw: string): FriendRequestDto {
	const parsed: unknown = JSON.parse(quoteFriendRequestIds(raw));
	assertFriendRequestDto(parsed);
	return parsed;
}

function parseFriendRequestList(raw: string): FriendRequestDto[] {
	const parsed: unknown = JSON.parse(quoteFriendRequestIds(raw));
	assertFriendRequestDtoList(parsed);
	return parsed;
}

export async function apiSendFriendRequest(
	payload: SendFriendRequestDto,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	assertSendFriendRequest(payload);
	const response = await apiClient.postText<SendFriendRequestDto>(
		"/friends/request",
		payload,
		{
			signal,
			requiresAuth: true,
		},
	);
	return parseFriendRequest(response);
}

export async function apiGetIncomingFriendRequests(
	signal?: AbortSignal,
): Promise<FriendRequestDto[]> {
	const response = await apiClient.getText("/friends/requests/incoming", {
		signal,
		requiresAuth: true,
	});
	return parseFriendRequestList(response);
}

export async function apiGetOutgoingFriendRequests(
	signal?: AbortSignal,
): Promise<FriendRequestDto[]> {
	const response = await apiClient.getText("/friends/requests/outgoing", {
		signal,
		requiresAuth: true,
	});
	return parseFriendRequestList(response);
}

export async function apiAcceptFriendRequest(
	requestId: string,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	const response = await apiClient.postText<Record<string, never>>(
		`/friends/requests/${requestId}/accept`,
		{},
		{
			signal,
			requiresAuth: true,
		},
	);
	return parseFriendRequest(response);
}

export async function apiDeclineFriendRequest(
	requestId: string,
	signal?: AbortSignal,
): Promise<FriendRequestDto> {
	const response = await apiClient.postText<Record<string, never>>(
		`/friends/requests/${requestId}/decline`,
		{},
		{
			signal,
			requiresAuth: true,
		},
	);
	return parseFriendRequest(response);
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
