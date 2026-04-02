export const en = {
	app: {
		title: "Haven",
		loading: "Loading...",
		help: "Help",
		externalLinkWarning:
			"Warning: You are leaving Haven to visit an external website:\n\n{{url}}\n\nDo you want to continue?",
	},
	home: {
		title: "Home View",
	},
	auth: {
		loginTitle: "Welcome back!",
		registerTitle: "Create an account",
		username: "USERNAME",
		displayName: "DISPLAY NAME",
		email: "EMAIL",
		password: "PASSWORD",
		dob: "DATE OF BIRTH",
		dobFormatDe: "DD-MM-YYYY",
		dobFormatEn: "YYYY-MM-DD",
		loginBtn: "Login",
		registerBtn: "Register",
		loadingBtn: "Loading...",

		welcomeTitle: "Welcome to Haven",
		welcomeDesc:
			"Haven is your new home for secure, real-time communication. Connect with friends and communities effortlessly.",
		step1Title: "Choose a Username",
		step1Desc:
			"Your username is unique and identifies you. You can change your display name later.",
		step2Title: "What should we call you?",
		step2Desc:
			"This is what others will see. Feel free to use your real name or a nickname!",
		step3Title: "When were you born?",
		step3Desc:
			"We use this to customize Haven for you. There is no minimum or maximum age requirement right now.",
		step4Title: "What's your email?",
		step4Desc:
			"We use this for verification. Our code system is coming later, so this step is skipped for now.",
		step5Title: "Create a password",
		step5Desc:
			"Make it strong! You need at least 10 chars, including an uppercase letter and a special character.",
		confirmPassword: "CONFIRM PASSWORD",
		errPasswordMismatch: "The passwords do not match.",
		nextBtn: "Next",
		backBtn: "Back",
		finishBtn: "Create Account",
		startRegisterBtn: "Get Started",
		loginLink: "Already have an account? Login here",
		registerLink: "New to Haven? Register here",

		needAccount: "Need an account?",
		alreadyRegistered: "Already registered?",
		errorGeneric: "Authentication failed. Please check your inputs.",
		errUsername:
			"Username must be 3-32 characters, lowercase letters and numbers only.",
		errEmail: "Please enter a valid email address.",
		errEmailDomain:
			"The email domain is invalid or does not support receiving emails.",
		errDisplayName: "Display name must be 1-64 characters (letters/numbers).",
		errPassword:
			"Password must be at least 10 chars, 1 uppercase and 1 special character.",
		errDob: "Invalid date of birth. Check the format.",
	},
} as const;
