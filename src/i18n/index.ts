import { en } from "./en";

type Locale = "en";

const dictionaries = {
	en,
} as const;

type Dictionary = typeof dictionaries.en;
type GroupKey = keyof Dictionary;
type MessageKey<G extends GroupKey> = keyof Dictionary[G] & string;

const currentLocale: Locale = "en";

export function t<G extends GroupKey>(group: G, key: MessageKey<G>): string {
	return dictionaries[currentLocale][group][key] as string;
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
