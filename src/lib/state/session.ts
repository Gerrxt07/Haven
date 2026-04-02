import { createStore } from "solid-js/store";

import type { AuthUserResponse } from "../api";

export type SessionStore = {
	accessToken: string | null;
	refreshToken: string | null;
	currentUser: AuthUserResponse | null;
	initialized: boolean;
};

const [sessionStore, setSessionStore] = createStore<SessionStore>({
	accessToken: null,
	refreshToken: null,
	currentUser: null,
	initialized: false,
});

export function setSessionSnapshot(snapshot: {
	accessToken: string | null;
	refreshToken: string | null;
	currentUser: AuthUserResponse | null;
}): void {
	setSessionStore({
		...snapshot,
		initialized: true,
	});
}

export { sessionStore };
