import type { AuthUserResponse } from "../api";
import { nativeApp } from "../native";

const PROFILE_CACHE_NAMESPACE = "profile-image-cache";
const PROFILE_CACHE_PREFIX = "user:";
const API_ORIGIN = "https://havenapi.becloudly.eu";

type CachedProfileImage = {
	dataUrl: string;
	sourceUrl: string | null;
	cachedAt: number;
};

type UserWithAvatarFields = AuthUserResponse & {
	avatar_url?: string | null;
	profile_image_url?: string | null;
	profile_picture_url?: string | null;
	profile_picture?: string | null;
	image_url?: string | null;
	photo_url?: string | null;
	avatarUrl?: string | null;
	profilePictureUrl?: string | null;
	avatar?: string | null;
};

const memoryCache = new Map<number, CachedProfileImage>();
const inFlightByUser = new Map<number, Promise<string>>();

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function pickAvatarUrl(
	user: UserWithAvatarFields | null | undefined,
): string | null {
	if (!user) {
		return null;
	}

	const candidates = [
		user.avatar_url,
		user.profile_image_url,
		user.profile_picture_url,
		user.profile_picture,
		user.image_url,
		user.photo_url,
		user.avatarUrl,
		user.profilePictureUrl,
		user.avatar,
	];

	for (const candidate of candidates) {
		if (isNonEmptyString(candidate)) {
			return candidate;
		}
	}

	return null;
}

function isDataUrl(value: string): boolean {
	return /^data:image\//.test(value);
}

function normalizeAvatarUrl(value: string): string {
	if (/^(data:|blob:|https?:)/i.test(value)) {
		return value;
	}

	return new URL(value, API_ORIGIN).toString();
}

function toStorageKey(userId: number): string {
	return `${PROFILE_CACHE_PREFIX}${userId}`;
}

async function readPersisted(
	userId: number,
): Promise<CachedProfileImage | null> {
	try {
		const raw = await nativeApp.secureStoreGet(
			PROFILE_CACHE_NAMESPACE,
			toStorageKey(userId),
		);
		if (!raw) {
			return null;
		}
		return JSON.parse(raw) as CachedProfileImage;
	} catch {
		return null;
	}
}

async function persist(
	userId: number,
	entry: CachedProfileImage,
): Promise<void> {
	memoryCache.set(userId, entry);

	const payload = JSON.stringify(entry);

	try {
		await nativeApp.secureStoreSet(
			PROFILE_CACHE_NAMESPACE,
			toStorageKey(userId),
			payload,
		);
	} catch {
		// Ignore cache write failures.
	}
}

export async function clearCachedProfileImage(userId: number): Promise<void> {
	memoryCache.delete(userId);

	try {
		await nativeApp.secureStoreDelete(
			PROFILE_CACHE_NAMESPACE,
			toStorageKey(userId),
		);
	} catch {
		// Ignore cache delete failures.
	}
}

async function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Failed to read image blob"));
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}
			reject(new Error("Unsupported image data format"));
		};
		reader.readAsDataURL(blob);
	});
}

export async function fileToImageDataUrl(file: File): Promise<string> {
	return blobToDataUrl(file);
}

export async function cacheProfileImageDataUrl(
	userId: number,
	dataUrl: string,
	sourceUrl: string | null,
): Promise<void> {
	if (!isDataUrl(dataUrl)) {
		return;
	}

	await persist(userId, {
		dataUrl,
		sourceUrl,
		cachedAt: Date.now(),
	});
}

export async function resolveProfileImageForUser(
	user: UserWithAvatarFields | null | undefined,
	fallbackImage: string,
	accessToken?: string | null,
): Promise<string> {
	if (!user) {
		return fallbackImage;
	}

	const userId = user.id;
	const rawAvatarUrl = pickAvatarUrl(user);
	const avatarUrl = rawAvatarUrl ? normalizeAvatarUrl(rawAvatarUrl) : null;
	const memory = memoryCache.get(userId);
	if (memory && (!avatarUrl || memory.sourceUrl === avatarUrl)) {
		return memory.dataUrl;
	}

	const pending = inFlightByUser.get(userId);
	if (pending) {
		return pending;
	}

	const task = (async () => {
		const persisted = await readPersisted(userId);
		if (persisted && (!avatarUrl || persisted.sourceUrl === avatarUrl)) {
			memoryCache.set(userId, persisted);
			return persisted.dataUrl;
		}

		if (!avatarUrl) {
			return fallbackImage;
		}

		if (isDataUrl(avatarUrl)) {
			await cacheProfileImageDataUrl(userId, avatarUrl, avatarUrl);
			return avatarUrl;
		}

		try {
			const response = await fetch(avatarUrl, {
				cache: "force-cache",
				headers: accessToken
					? {
							authorization: `Bearer ${accessToken}`,
						}
					: undefined,
			});
			if (!response.ok) {
				throw new Error(`Failed to fetch avatar (${response.status})`);
			}

			const blob = await response.blob();
			const dataUrl = await blobToDataUrl(blob);
			await cacheProfileImageDataUrl(userId, dataUrl, avatarUrl);
			return dataUrl;
		} catch {
			const lastKnownImage = persisted?.dataUrl ?? memory?.dataUrl;
			if (lastKnownImage) {
				return lastKnownImage;
			}

			return fallbackImage;
		}
	})();

	inFlightByUser.set(userId, task);

	try {
		return await task;
	} finally {
		inFlightByUser.delete(userId);
	}
}

export async function primeRelatedUserAvatar(
	userId: number,
	avatarUrl: string | null | undefined,
): Promise<void> {
	if (!isNonEmptyString(avatarUrl)) {
		return;
	}

	const resolvedAvatarUrl = normalizeAvatarUrl(avatarUrl);

	const cached = memoryCache.get(userId) ?? (await readPersisted(userId));
	if (cached?.sourceUrl === resolvedAvatarUrl) {
		memoryCache.set(userId, cached);
		return;
	}

	if (isDataUrl(resolvedAvatarUrl)) {
		await cacheProfileImageDataUrl(
			userId,
			resolvedAvatarUrl,
			resolvedAvatarUrl,
		);
		return;
	}

	try {
		const response = await fetch(resolvedAvatarUrl, { cache: "force-cache" });
		if (!response.ok) {
			return;
		}

		const blob = await response.blob();
		const dataUrl = await blobToDataUrl(blob);
		await cacheProfileImageDataUrl(userId, dataUrl, resolvedAvatarUrl);
	} catch {
		// Ignore warmup failures.
	}
}
