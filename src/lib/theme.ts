import { createSignal } from "solid-js";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "haven.theme";

const [theme, setThemeSignal] = createSignal<Theme>("dark");
const [hasStoredTheme, setHasStoredTheme] = createSignal(false);

function applyTheme(next: Theme): void {
	const root = globalThis.document?.documentElement;
	if (!root) {
		return;
	}

	root.dataset.theme = next;
	root.style.colorScheme = next;
}

function withThemeTransition(): void {
	const body = globalThis.document?.body;
	if (!body) {
		return;
	}

	body.classList.add("theme-transition");
	globalThis.setTimeout(() => {
		body.classList.remove("theme-transition");
	}, 260);
}

export function initTheme(): void {
	const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
	if (stored === "light" || stored === "dark") {
		setThemeSignal(stored);
		setHasStoredTheme(true);
	}

	applyTheme(theme());
}

export function setTheme(next: Theme): void {
	setThemeSignal(next);
	setHasStoredTheme(true);
	globalThis.localStorage?.setItem(THEME_STORAGE_KEY, next);
	applyTheme(next);
	withThemeTransition();
}

export function toggleTheme(): void {
	setTheme(theme() === "dark" ? "light" : "dark");
}

export const currentTheme = theme;
export const hasThemeSelection = hasStoredTheme;
