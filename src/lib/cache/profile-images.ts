import type { AuthUserResponse } from "../api";

const PROFILE_CACHE_NAMESPACE = "profile-image-cache";
const PROFILE_CACHE_PREFIX = "user:";
const PROFILE_LOCAL_STORAGE_PREFIX = "haven.profile-image.";
const API_ORIGIN = "https://havenapi.becloudly.eu";
const MAX_INLINE_CACHE_PAYLOAD_LENGTH = 128_000;

type CacheMode = "inline" | "source-url";

type CachedProfileImage = {
	imageSrc: string;
	sourceUrl: string | null;
	cachedAt: number;
	mode: CacheMode;
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

function normalizePersistedEntry(raw: unknown): CachedProfileImage | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const entry = raw as Record<string, unknown>;
	const sourceUrl =
		typeof entry.sourceUrl === "string" ? entry.sourceUrl : null;
	const cachedAt =
		typeof entry.cachedAt === "number" ? entry.cachedAt : Date.now();
	const mode = entry.mode === "source-url" ? "source-url" : "inline";

	if (mode === "source-url") {
		if (!isNonEmptyString(sourceUrl)) {
			return null;
		}
		return {
			imageSrc: sourceUrl,
			sourceUrl,
			cachedAt,
			mode,
		};
	}

	const imageSrc =
		typeof entry.imageSrc === "string"
			? entry.imageSrc
			: typeof entry.dataUrl === "string"
				? entry.dataUrl
				: null;
	if (!isNonEmptyString(imageSrc)) {
		return null;
	}

	return {
		imageSrc,
		sourceUrl,
		cachedAt,
		mode,
	};
}

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
				return null;
			}
			return normalizePersistedEntry(JSON.parse(raw));
		}

		const raw = globalThis.localStorage?.getItem(toLocalStorageKey(userId));
		if (!raw) {
			return null;
		}
		return normalizePersistedEntry(JSON.parse(raw));
	} catch {
		return null;
	}
}

type PersistOptions = {
	persistToDisk?: boolean;
};

async function persist(
	userId: number,
	entry: CachedProfileImage,
	options?: PersistOptions,
): Promise<void> {
	memoryCache.set(userId, entry);
	if (options?.persistToDisk === false) {
		return;
	}

	const payload = JSON.stringify(
		entry.mode === "source-url"
			? {
					sourceUrl: entry.sourceUrl,
					cachedAt: entry.cachedAt,
					mode: entry.mode,
				}
			: {
					imageSrc: entry.imageSrc,
					sourceUrl: entry.sourceUrl,
					cachedAt: entry.cachedAt,
					mode: entry.mode,
				},
	);

	try {
		if (secureStoreAvailable()) {
			await globalThis.electronAPI.secureStoreSet(
				PROFILE_CACHE_NAMESPACE,
				toStorageKey(userId),
				payload,
			);
			return;
		}

		globalThis.localStorage?.setItem(toLocalStorageKey(userId), payload);
	} catch {
		// Ignore cache write failures.
	}
}

export async function clearCachedProfileImage(userId: number): Promise<void> {
	memoryCache.delete(userId);

	try {
		if (secureStoreAvailable()) {
			await globalThis.electronAPI.secureStoreDelete(
				PROFILE_CACHE_NAMESPACE,
				toStorageKey(userId),
			);
			return;
		}

		globalThis.localStorage?.removeItem(toLocalStorageKey(userId));
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

	await persist(
		userId,
		{
			imageSrc: dataUrl,
			sourceUrl,
			cachedAt: Date.now(),
			mode: "inline",
		},
		{
			persistToDisk: dataUrl.length <= MAX_INLINE_CACHE_PAYLOAD_LENGTH,
		},
	);
}

export async function resolveProfileImageForUser(
	user: UserWithAvatarFields | null | undefined,
	fallbackImage: string,
	accessToken?: string | null,
): Promise<string> {
	void accessToken;

	if (!user) {
		return fallbackImage;
	}

	const userId = user.id;
	const rawAvatarUrl = pickAvatarUrl(user);
	const avatarUrl = rawAvatarUrl ? normalizeAvatarUrl(rawAvatarUrl) : null;
	const memory = memoryCache.get(userId);
	if (memory && (!avatarUrl || memory.sourceUrl === avatarUrl)) {
		return memory.imageSrc;
	}

	const pending = inFlightByUser.get(userId);
	if (pending) {
		return pending;
	}

	const task = (async () => {
		const persisted = await readPersisted(userId);
		if (persisted && (!avatarUrl || persisted.sourceUrl === avatarUrl)) {
			memoryCache.set(userId, persisted);
			return persisted.imageSrc;
		}

		if (!avatarUrl) {
			return fallbackImage;
		}

		if (isDataUrl(avatarUrl)) {
			await cacheProfileImageDataUrl(userId, avatarUrl, avatarUrl);
			return avatarUrl;
		}

		await persist(userId, {
			imageSrc: avatarUrl,
			sourceUrl: avatarUrl,
			cachedAt: Date.now(),
			mode: "source-url",
		});
		return avatarUrl;
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

	await persist(userId, {
		imageSrc: resolvedAvatarUrl,
		sourceUrl: resolvedAvatarUrl,
		cachedAt: Date.now(),
		mode: "source-url",
	});
}
