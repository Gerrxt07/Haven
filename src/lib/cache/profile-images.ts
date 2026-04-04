import type { AuthUserResponse } from "../api";
import { apiClient } from "../api";
import { safeInfo, safeWarn } from "../security/redaction";

const PROFILE_CACHE_NAMESPACE = "profile-image-cache";
const PROFILE_CACHE_PREFIX = "user:";
const PROFILE_LOCAL_STORAGE_PREFIX = "haven.profile-image.";
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

	return apiClient.resolveUrl(value);
}

function secureStoreAvailable(): boolean {
	return typeof globalThis.electronAPI !== "undefined";
}

function toStorageKey(userId: number): string {
	return `${PROFILE_CACHE_PREFIX}${userId}`;
}

function toLocalStorageKey(userId: number): string {
	return `${PROFILE_LOCAL_STORAGE_PREFIX}${userId}`;
}

async function readPersisted(
	userId: number,
): Promise<CachedProfileImage | null> {
	try {
		if (secureStoreAvailable()) {
			const raw = await globalThis.electronAPI.secureStoreGet(
				PROFILE_CACHE_NAMESPACE,
				toStorageKey(userId),
			);
			if (!raw) {
				safeInfo("profile-image cache miss (secure store)", { userId });
				return null;
			}
			safeInfo("profile-image cache hit (secure store)", { userId });
			return JSON.parse(raw) as CachedProfileImage;
		}

		const raw = globalThis.localStorage?.getItem(toLocalStorageKey(userId));
		if (!raw) {
			safeInfo("profile-image cache miss (local storage)", { userId });
			return null;
		}
		safeInfo("profile-image cache hit (local storage)", { userId });
		return JSON.parse(raw) as CachedProfileImage;
	} catch {
		safeWarn("profile-image persisted cache read failed", { userId });
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
		if (secureStoreAvailable()) {
			await globalThis.electronAPI.secureStoreSet(
				PROFILE_CACHE_NAMESPACE,
				toStorageKey(userId),
				payload,
			);
			safeInfo("profile-image cache write (secure store)", {
				userId,
				hasSourceUrl: Boolean(entry.sourceUrl),
			});
			return;
		}

		globalThis.localStorage?.setItem(toLocalStorageKey(userId), payload);
		safeInfo("profile-image cache write (local storage)", {
			userId,
			hasSourceUrl: Boolean(entry.sourceUrl),
		});
	} catch {
		safeWarn("profile-image cache write failed", {
			userId,
			hasSourceUrl: Boolean(entry.sourceUrl),
		});
	}
}

export async function clearCachedProfileImage(userId: number): Promise<void> {
	memoryCache.delete(userId);
	safeInfo("profile-image memory cache cleared", { userId });

	try {
		if (secureStoreAvailable()) {
			await globalThis.electronAPI.secureStoreDelete(
				PROFILE_CACHE_NAMESPACE,
				toStorageKey(userId),
			);
			safeInfo("profile-image persisted cache cleared (secure store)", {
				userId,
			});
			return;
		}

		globalThis.localStorage?.removeItem(toLocalStorageKey(userId));
		safeInfo("profile-image persisted cache cleared (local storage)", {
			userId,
		});
	} catch {
		safeWarn("profile-image persisted cache clear failed", { userId });
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
		safeInfo("profile-image resolve skipped (no user)");
		return fallbackImage;
	}

	const userId = user.id;
	const rawAvatarUrl = pickAvatarUrl(user);
	const avatarUrl = rawAvatarUrl ? normalizeAvatarUrl(rawAvatarUrl) : null;
	safeInfo("profile-image resolve started", {
		userId,
		hasAvatarUrl: Boolean(avatarUrl),
		hasAccessToken: Boolean(accessToken),
	});
	const memory = memoryCache.get(userId);
	if (memory && (!avatarUrl || memory.sourceUrl === avatarUrl)) {
		safeInfo("profile-image resolve hit memory cache", { userId });
		return memory.dataUrl;
	}

	const pending = inFlightByUser.get(userId);
	if (pending) {
		safeInfo("profile-image resolve joined in-flight request", { userId });
		return pending;
	}

	const task = (async () => {
		const persisted = await readPersisted(userId);
		if (persisted && (!avatarUrl || persisted.sourceUrl === avatarUrl)) {
			memoryCache.set(userId, persisted);
			safeInfo("profile-image resolve hit persisted cache", { userId });
			return persisted.dataUrl;
		}

		if (!avatarUrl) {
			safeInfo("profile-image resolve fallback (no avatar url)", { userId });
			return fallbackImage;
		}

		if (isDataUrl(avatarUrl)) {
			await cacheProfileImageDataUrl(userId, avatarUrl, avatarUrl);
			safeInfo("profile-image resolve using data-url avatar", { userId });
			return avatarUrl;
		}

		safeInfo("profile-image resolve fetching remote avatar", {
			userId,
			avatarUrl,
		});
		const response = await fetch(avatarUrl, {
			cache: "force-cache",
			headers: accessToken
				? {
						authorization: `Bearer ${accessToken}`,
					}
				: undefined,
		});
		if (!response.ok) {
			safeWarn("profile-image resolve remote fetch failed", {
				userId,
				avatarUrl,
				status: response.status,
			});
			throw new Error(`Failed to fetch avatar (${response.status})`);
		}

		const blob = await response.blob();
		const dataUrl = await blobToDataUrl(blob);
		await cacheProfileImageDataUrl(userId, dataUrl, avatarUrl);
		safeInfo("profile-image resolve fetched and cached remote avatar", {
			userId,
			avatarUrl,
			sizeBytes: blob.size,
		});
		return dataUrl;
	})();

	inFlightByUser.set(userId, task);

	try {
		return await task;
	} catch {
		safeWarn("profile-image resolve failed, using fallback", { userId });
		return fallbackImage;
	} finally {
		inFlightByUser.delete(userId);
	}
}

export async function primeRelatedUserAvatar(
	userId: number,
	avatarUrl: string | null | undefined,
): Promise<void> {
	if (!isNonEmptyString(avatarUrl)) {
		safeInfo("profile-image prime skipped (missing avatar url)", { userId });
		return;
	}

	const resolvedAvatarUrl = normalizeAvatarUrl(avatarUrl);

	const cached = memoryCache.get(userId) ?? (await readPersisted(userId));
	if (cached?.sourceUrl === resolvedAvatarUrl) {
		memoryCache.set(userId, cached);
		safeInfo("profile-image prime skipped (already cached)", {
			userId,
			avatarUrl: resolvedAvatarUrl,
		});
		return;
	}

	if (isDataUrl(resolvedAvatarUrl)) {
		await cacheProfileImageDataUrl(
			userId,
			resolvedAvatarUrl,
			resolvedAvatarUrl,
		);
		safeInfo("profile-image prime cached data-url avatar", { userId });
		return;
	}

	try {
		safeInfo("profile-image prime fetching remote avatar", {
			userId,
			avatarUrl: resolvedAvatarUrl,
		});
		const response = await fetch(resolvedAvatarUrl, { cache: "force-cache" });
		if (!response.ok) {
			safeWarn("profile-image prime remote fetch failed", {
				userId,
				avatarUrl: resolvedAvatarUrl,
				status: response.status,
			});
			return;
		}

		const blob = await response.blob();
		const dataUrl = await blobToDataUrl(blob);
		await cacheProfileImageDataUrl(userId, dataUrl, resolvedAvatarUrl);
		safeInfo("profile-image prime fetched and cached remote avatar", {
			userId,
			avatarUrl: resolvedAvatarUrl,
			sizeBytes: blob.size,
		});
	} catch {
		safeWarn("profile-image prime failed", {
			userId,
			avatarUrl: resolvedAvatarUrl,
		});
	}
}
