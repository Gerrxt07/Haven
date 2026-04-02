import { de } from "./de";
import { en } from "./en";

const dictionaries = {
	en,
	de,
} as const;

type Locale = keyof typeof dictionaries;
type Dictionary = typeof dictionaries.en;
type GroupKey = keyof Dictionary;
type MessageKey<G extends GroupKey> = keyof Dictionary[G] & string;

export function getSystemLocale(): Locale {
	const sys = globalThis.navigator?.language?.substring(0, 2)?.toLowerCase();
	return sys === "de" ? "de" : "en";
}

let currentLocale: Locale = getSystemLocale();

export function setLocale(locale: Locale) {
	currentLocale = locale;
}

export function currentLang(): string {
	return currentLocale;
}

export function t<G extends GroupKey>(group: G, key: MessageKey<G>): string {
	// Falls etwas fehlt, Fallback auf en
	const localDict = dictionaries[currentLocale][group] as Record<
		string,
		string
	>;
	return (
		localDict[key as string] ||
		(dictionaries.en[group] as Record<string, string>)[key as string]
	);
}

export function tf<G extends GroupKey>(
	group: G,
	key: MessageKey<G>,
	variables: Record<string, string>,
): string {
	let message = t(group, key);
	for (const [variableName, variableValue] of Object.entries(variables)) {
		message = message.replaceAll(`{{${variableName}}}`, variableValue);
	}
	return message;
}
