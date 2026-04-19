import { createIdempotencyKey } from "./idempotency";
import { apiClient } from "./index";
import type {
	CreateDmMessageRequestDto,
	CreateDmThreadRequestDto,
	DmMessageDto,
	DmThreadDto,
} from "./models";
import {
	assertCreateDmMessageRequest,
	assertCreateDmThreadRequest,
	assertDmMessageDto,
	assertDmMessageDtoList,
	assertDmThreadDto,
	assertDmThreadDtoList,
} from "./validation";

export async function apiCreateDmThread(
	payload: CreateDmThreadRequestDto,
	signal?: AbortSignal,
): Promise<DmThreadDto> {
	assertCreateDmThreadRequest(payload);
	const response = await apiClient.post<CreateDmThreadRequestDto, DmThreadDto>(
		"/dm/threads",
		payload,
		{
			signal,
			requiresAuth: true,
			idempotencyKey: createIdempotencyKey("create-dm-thread"),
		},
	);
	assertDmThreadDto(response);
	return response;
}

export async function apiListDmThreads(params?: {
	before?: number;
	limit?: number;
	signal?: AbortSignal;
}): Promise<DmThreadDto[]> {
	const search = new URLSearchParams();
	if (params?.before !== undefined) {
		search.set("before", String(params.before));
	}
	if (params?.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	const query = search.toString();

	const response = await apiClient.get<DmThreadDto[]>(
		`/dm/threads${query ? `?${query}` : ""}`,
		{
			signal: params?.signal,
			requiresAuth: true,
		},
	);
	assertDmThreadDtoList(response);
	return response;
}

export async function apiCreateDmMessage(
	threadId: number,
	payload: CreateDmMessageRequestDto,
	signal?: AbortSignal,
): Promise<DmMessageDto> {
	assertCreateDmMessageRequest(payload);
	const response = await apiClient.post<
		CreateDmMessageRequestDto,
		DmMessageDto
	>(`/dm/threads/${threadId}/messages`, payload, {
		signal,
		requiresAuth: true,
		idempotencyKey: createIdempotencyKey("create-dm-message"),
	});
	assertDmMessageDto(response);
	return response;
}

export async function apiListDmMessages(params: {
	threadId: number;
	before?: number;
	limit?: number;
	signal?: AbortSignal;
}): Promise<DmMessageDto[]> {
	const search = new URLSearchParams();
	if (params.before !== undefined) {
		search.set("before", String(params.before));
	}
	if (params.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	const query = search.toString();

	const response = await apiClient.get<DmMessageDto[]>(
		`/dm/threads/${params.threadId}/messages${query ? `?${query}` : ""}`,
		{
			signal: params.signal,
			requiresAuth: true,
		},
	);
	assertDmMessageDtoList(response);
	return response;
}
