import type { JSX } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import type { AuthUserResponse } from "../../lib/api";
import { authSession } from "../../lib/auth/session";
import { resolveProfileImageForUser } from "../../lib/cache/profile-images";

type ProfileAvatarProps = {
	userId: number | string;
	displayName: string;
	avatarUrl?: string | null;
	class?: string;
	loading?: "eager" | "lazy";
};

export function ProfileAvatar(props: ProfileAvatarProps): JSX.Element {
	const fallbackProfileImage = new URL(
		"profile.png",
		globalThis.location.href,
	).toString();
	const [avatarSrc, setAvatarSrc] = createSignal(fallbackProfileImage);
	let resolveToken = 0;

	createEffect(() => {
		const token = ++resolveToken;
		const avatarUser = {
			id: props.userId,
			username: "",
			display_name: props.displayName,
			avatar_url: props.avatarUrl,
		} as AuthUserResponse;

		void resolveProfileImageForUser(
			avatarUser,
			fallbackProfileImage,
			authSession.accessToken,
		).then((src) => {
			if (token !== resolveToken) {
				return;
			}
			setAvatarSrc(src);
		});
	});

	return (
		<img
			src={avatarSrc()}
			alt={`${props.displayName} avatar`}
			class={props.class}
			loading={props.loading}
			onError={(event) => {
				if (event.currentTarget.src !== fallbackProfileImage) {
					event.currentTarget.src = fallbackProfileImage;
				}
			}}
		/>
	);
}
