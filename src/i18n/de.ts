export const de = {
	app: {
		title: "Haven",
		loading: "Laden...",
		help: "Hilfe",
		account: "Konto",
		settings: "Einstellungen",
		externalLinkWarning:
			"Warnung: Du verlässt Haven, um eine externe Website zu besuchen:\n\n{{url}}\n\nWillst du fortfahren?",
	},
	home: {
		title: "Startseite",
	},
	auth: {
		loginTitle: "Willkommen zurück!",
		registerTitle: "Erstelle einen Account",
		username: "BENUTZERNAME",
		displayName: "ANZEIGENAME",
		email: "EMAIL",
		password: "PASSWORT",
		dob: "GEBURTSDATUM",
		dobFormatDe: "TT-MM-JJJJ",
		dobFormatEn: "YYYY-MM-DD",
		loginBtn: "Einloggen",
		registerBtn: "Registrieren",
		loadingBtn: "Laden...",

		welcomeTitle: "Willkommen bei Haven",
		welcomeDesc:
			"Haven ist dein neues Zuhause für sichere Echtzeit-Kommunikation. Verbinde dich mühelos mit Freunden und Communities.",
		step1Title: "Wähle einen Benutzernamen",
		step1Desc:
			"Dein Benutzername ist einmalig und identifiziert dich. Den Anzeigenamen kannst du später jederzeit ändern.",
		step2Title: "Wie sollen wir dich nennen?",
		step2Desc:
			"Das ist das, was andere im Chat sehen. Verwende gerne deinen echten Namen oder einen Spitznamen!",
		step3Title: "Wann bist du geboren?",
		step3Desc:
			"Wir passen Haven für dich an. Es gibt aktuell kein Mindest- oder Höchstalter.",
		step4Title: "Wie lautet deine E-Mail?",
		step4Desc:
			"Wir nutzen dies zur Verifizierung. Das Code-System kommt erst später, dieser Schritt wird also fürs Erste übersprungen.",
		step5Title: "Erstelle ein Passwort",
		step5Desc:
			"Mache es sicher! Du brauchst mind. 10 Zeichen, inkl. Großbuchstaben und Sonderzeichen.",
		confirmPassword: "PASSWORT WIEDERHOLEN",
		errPasswordMismatch: "Die Passwörter stimmen nicht überein.",
		nextBtn: "Weiter",
		backBtn: "Zurück",
		finishBtn: "Account erstellen",
		startRegisterBtn: "Jetzt Loslegen",
		loginLink: "Hast du schon einen Account? Hier einloggen",
		registerLink: "Neu bei Haven? Hier registrieren",

		needAccount: "Brauchst du einen Account?",
		alreadyRegistered: "Bereits registriert?",
		errorGeneric:
			"Authentifizierung fehlgeschlagen. Bitte prüfe deine Eingaben.",
		errUsername:
			"Benutzername muss 3-32 Zeichen lang sein und darf nur Kleinbuchstaben/Zahlen enthalten.",
		errEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
		errEmailDomain:
			"Die E-Mail-Domain ist ungültig oder kann keine E-Mails empfangen.",
		errDisplayName:
			"Anzeigename muss 1-64 Zeichen lang sein (Buchstaben/Zahlen).",
		errPassword:
			"Passwort muss mind. 10 Zeichen, 1 Großbuchstaben und 1 Sonderzeichen enthalten.",
		errDob: "Ungültiges Geburtsdatum. Achte auf das Format.",
	},
} as const;
