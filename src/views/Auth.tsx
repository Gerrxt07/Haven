import { validate as validateEmail } from "email-validator";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-solid";
import { createSignal, Match, Switch } from "solid-js";
import { Motion } from "solid-motionone";
import { currentLang, t } from "../i18n";
import { HttpApiError } from "../lib/api";
import { authSession } from "../lib/auth/session";

export default function AuthView() {
	const [view, setView] = createSignal<"welcome" | "login" | "register">(
		"welcome",
	);
	const [step, setStep] = createSignal(1);

	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [confirmPassword, setConfirmPassword] = createSignal("");
	const [showPassword, setShowPassword] = createSignal(false);
	const [username, setUsername] = createSignal("");
	const [displayName, setDisplayName] = createSignal("");
	const [dob, setDob] = createSignal("");
	const [verificationCode, setVerificationCode] = createSignal("");

	const [error, setError] = createSignal("");
	const [loading, setLoading] = createSignal(false);

	const handleUsernameInput = (val: string) => {
		setUsername(val.toLowerCase().replace(/[^a-z0-9]/g, ""));
	};

	const handleDobInput = (val: string) => {
		const digits = val.replace(/\D/g, "");
		let formatted = digits;
		const lang = currentLang();
		if (lang === "de") {
			if (digits.length > 4) {
				formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
			} else if (digits.length > 2) {
				formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
			}
		} else {
			if (digits.length > 6) {
				formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
			} else if (digits.length > 4) {
				formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
			}
		}
		setDob(formatted);
	};

	const validateStep = async (currentStep: number) => {
		setError("");
		if (currentStep === 1) {
			if (username().length < 3 || username().length > 32) {
				setError(t("auth", "errUsername"));
				return false;
			}
		} else if (currentStep === 2) {
			if (
				displayName().length < 1 ||
				displayName().length > 64 ||
				!/^[a-zA-Z0-9 ]+$/.test(displayName())
			) {
				setError(t("auth", "errDisplayName"));
				return false;
			}
		} else if (currentStep === 3) {
			const lang = currentLang();
			let parsedDate: string;

			if (lang === "de") {
				if (!/^\d{2}-\d{2}-\d{4}$/.test(dob())) {
					setError(t("auth", "errDob"));
					return false;
				}
				const [_d, _m, _y] = dob().split("-");
				parsedDate = `${_y}-${_m}-${_d}`;
			} else {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(dob())) {
					setError(t("auth", "errDob"));
					return false;
				}
				parsedDate = dob();
			}

			if (Number.isNaN(Date.parse(parsedDate))) {
				setError(t("auth", "errDob"));
				return false;
			}
			return parsedDate;
		} else if (currentStep === 4) {
			if (!validateEmail(email())) {
				setError(t("auth", "errEmail"));
				return false;
			}
		} else if (currentStep === 5) {
			if (
				password().length < 10 ||
				password().length > 128 ||
				!/[A-Z]/.test(password()) ||
				!/[!@#$%^&*(),.?":{}|<>]/.test(password())
			) {
				setError(t("auth", "errPassword"));
				return false;
			}
			if (password() !== confirmPassword()) {
				setError(t("auth", "errPasswordMismatch"));
				return false;
			}
		} else if (currentStep === 6) {
			if (!/^\d{6}$/.test(verificationCode().trim())) {
				setError(t("auth", "errVerificationCode"));
				return false;
			}
		}
		return true;
	};

	const goNext = async () => {
		const isValid = await validateStep(step());
		if (!isValid) return;
		if (step() < 5) {
			setStep(step() + 1);
		} else if (step() === 5) {
			await registerUser();
		} else {
			await verifyEmailAndLogin();
		}
	};

	const goBack = () => {
		setError("");
		if (step() > 1) {
			setStep(step() - 1);
		} else {
			setView("welcome");
		}
	};

	const registerUser = async () => {
		setLoading(true);
		try {
			const parsedDobValid = await validateStep(3);
			await authSession.register({
				email: email(),
				username: username(),
				password: password(),
				display_name: displayName(),
				date_of_birth: parsedDobValid as string,
				locale: currentLang(),
			});
			await authSession.requestEmailVerification({
				email: email(),
			});
			setVerificationCode("");
			setStep(6);
		} catch (err: unknown) {
			console.error("Auth error", err);
			setError(readAuthError(err));
		} finally {
			setLoading(false);
		}
	};

	const verifyEmailAndLogin = async () => {
		setLoading(true);
		try {
			await authSession.confirmEmailVerification({
				email: email(),
				code: verificationCode().trim(),
			});
			await authSession.login({
				email: email(),
				password: password(),
			});
		} catch (err: unknown) {
			console.error("Auth error", err);
			setError(readAuthError(err));
		} finally {
			setLoading(false);
		}
	};

	const resendVerificationCode = async () => {
		setLoading(true);
		setError("");
		try {
			await authSession.requestEmailVerification({
				email: email(),
			});
		} catch (err: unknown) {
			console.error("Auth error", err);
			setError(readAuthError(err));
		} finally {
			setLoading(false);
		}
	};

	const readAuthError = (err: unknown): string => {
		if (!(err instanceof HttpApiError)) {
			return t("auth", "errorGeneric");
		}

		if (err.apiError.kind === "too-many-requests") {
			return t("auth", "errTooManyRequests");
		}

		const message = err.apiError.message.toLowerCase();
		if (message.includes("invalid verification code")) {
			return t("auth", "errVerificationCodeInvalid");
		}
		if (
			message.includes("verification code expired") ||
			message.includes("verification code not found")
		) {
			return t("auth", "errVerificationCodeExpired");
		}

		if (
			err.apiError.kind === "unauthorized" ||
			err.apiError.kind === "forbidden"
		) {
			return t("auth", "errInvalidCredentials");
		}

		return t("auth", "errorGeneric");
	};

	const loginUser = async (e: Event) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await authSession.login({
				email: email(),
				password: password(),
			});
		} catch (err: unknown) {
			console.error("Auth error", err);
			setError(readAuthError(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			class="w-full h-full flex items-center justify-center bg-cover bg-center"
			style={{ "background-image": "var(--auth-bg-image)" }}
		>
			<Motion.div
				initial={{ opacity: 0, y: 20, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.5, easing: "ease-out" }}
				class="bg-[color:var(--card-bg)] backdrop-blur-xl border border-[color:var(--card-border)] p-10 min-w-100 w-full max-w-lg rounded-3xl shadow-[var(--shadow-card)]"
			>
				<Switch>
					<Match when={view() === "welcome"}>
						<div class="text-center">
							<h1 class="text-[color:var(--text-primary)] text-4xl font-bold tracking-tight mb-4">
								{t("auth", "welcomeTitle")}
							</h1>
							<p class="text-[color:var(--text-secondary)] text-lg leading-relaxed mb-8">
								{t("auth", "welcomeDesc")}
							</p>

							<div class="flex flex-col gap-4 mt-6">
								<button
									type="button"
									onClick={() => setView("register")}
									class="w-full bg-[color:var(--button-primary-bg)] hover:bg-[color:var(--button-primary-hover)] text-[color:var(--button-primary-text)] font-bold p-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-[0_8px_24px_var(--button-primary-shadow)] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{t("auth", "startRegisterBtn")}
								</button>

								<button
									type="button"
									onClick={() => setView("login")}
									class="w-full bg-transparent hover:bg-[color:var(--button-secondary-hover)] border border-[color:var(--button-secondary-border)] text-[color:var(--button-secondary-text)] font-bold p-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{t("auth", "loginBtn")}
								</button>
							</div>
						</div>
					</Match>

					<Match when={view() === "login"}>
						<div>
							<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight text-center mb-8">
								{t("auth", "loginTitle")}
							</h2>

							{error() && (
								<Motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									class="bg-red-500/20 border border-red-500/30 text-red-200 p-3 rounded-xl mb-6 text-sm flex items-center gap-2"
								>
									{error()}
								</Motion.div>
							)}

							<form onSubmit={loginUser} class="flex flex-col gap-4">
								<div class="flex flex-col gap-1.5 p-1">
									<label
										for="email_login"
										class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
									>
										{t("auth", "email")}
									</label>
									<input
										id="email_login"
										type="email"
										class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
										value={email()}
										onInput={(e) => setEmail(e.target.value)}
										required
									/>
								</div>

								<div class="flex flex-col gap-1.5 p-1">
									<label
										for="password_login"
										class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
									>
										{t("auth", "password")}
									</label>
									<div class="relative flex items-center">
										<input
											id="password_login"
											type={showPassword() ? "text" : "password"}
											class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300 w-full pr-12"
											value={password()}
											onInput={(e) => setPassword(e.target.value)}
											required
										/>
										<button
											type="button"
											class="absolute right-4 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center justify-center"
											onClick={() => setShowPassword(!showPassword())}
											tabIndex={-1}
										>
											{showPassword() ? (
												<EyeOff size={20} />
											) : (
												<Eye size={20} />
											)}
										</button>
									</div>
								</div>

								<button
									type="submit"
									disabled={loading()}
									class="w-full bg-[color:var(--button-primary-bg)] hover:bg-[color:var(--button-primary-hover)] text-[color:var(--button-primary-text)] font-bold p-4 rounded-xl mt-6 transition-all duration-300 shadow-lg hover:shadow-[0_8px_24px_var(--button-primary-shadow)] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{loading() ? t("auth", "loadingBtn") : t("auth", "loginBtn")}
								</button>
							</form>

							<p class="text-[color:var(--text-tertiary)] text-sm mt-6 text-center font-medium">
								<button
									type="button"
									class="text-[color:var(--text-primary)] hover:text-[color:var(--text-secondary)] underline decoration-[color:var(--border-subtle)] hover:decoration-[color:var(--text-tertiary)] transition-all cursor-pointer bg-transparent border-none p-0 font-bold"
									onClick={() => {
										setView("welcome");
										setError("");
									}}
								>
									{t("auth", "backBtn")}
								</button>
							</p>
						</div>
					</Match>

					<Match when={view() === "register"}>
						<div>
							<div class="flex items-center justify-between mb-8">
								<button
									type="button"
									onClick={goBack}
									class="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center gap-2"
								>
									<ArrowLeft size={20} />
								</button>
								<span class="text-[color:var(--text-tertiary)] font-medium text-sm">
									Step {step()} / 6
								</span>
							</div>

							{error() && (
								<Motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									class="bg-red-500/20 border border-red-500/30 text-red-200 p-3 rounded-xl mb-6 text-sm flex items-center gap-2"
								>
									{error()}
								</Motion.div>
							)}

							<Switch>
								<Match when={step() === 1}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step1Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step1Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="username_reg"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "username")}
											</label>
											<input
												id="username_reg"
												type="text"
												class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
												value={username()}
												onInput={(e) => handleUsernameInput(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && goNext()}
												required
												minLength={3}
												maxLength={32}
												autofocus
											/>
										</div>
									</Motion.div>
								</Match>

								<Match when={step() === 2}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step2Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step2Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="displayName_reg"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "displayName")}
											</label>
											<input
												id="displayName_reg"
												type="text"
												class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
												value={displayName()}
												onInput={(e) => setDisplayName(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && goNext()}
												required
												minLength={1}
												maxLength={64}
												autofocus
											/>
										</div>
									</Motion.div>
								</Match>

								<Match when={step() === 3}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step3Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step3Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="dob_reg"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "dob")}
											</label>
											<input
												id="dob_reg"
												type="text"
												placeholder={
													currentLang() === "de"
														? t("auth", "dobFormatDe")
														: t("auth", "dobFormatEn")
												}
												class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
												value={dob()}
												onInput={(e) => handleDobInput(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && goNext()}
												required
												maxLength={10}
												autofocus
											/>
										</div>
									</Motion.div>
								</Match>

								<Match when={step() === 4}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step4Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step4Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="email_reg"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "email")}
											</label>
											<input
												id="email_reg"
												type="email"
												class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
												value={email()}
												onInput={(e) => setEmail(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && goNext()}
												required
												autofocus
											/>
										</div>
									</Motion.div>
								</Match>

								<Match when={step() === 5}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step5Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step5Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="password_reg"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "password")}
											</label>
											<div class="relative flex items-center">
												<input
													id="password_reg"
													type={showPassword() ? "text" : "password"}
													class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300 w-full pr-12"
													value={password()}
													onInput={(e) => setPassword(e.target.value)}
													required
													minLength={10}
													maxLength={128}
													autofocus
												/>
												<button
													type="button"
													class="absolute right-4 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center justify-center"
													onClick={() => setShowPassword(!showPassword())}
													tabIndex={-1}
												>
													{showPassword() ? (
														<EyeOff size={20} />
													) : (
														<Eye size={20} />
													)}
												</button>
											</div>
										</div>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="password_confirm"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "confirmPassword")}
											</label>
											<div class="relative flex items-center">
												<input
													id="password_confirm"
													type={showPassword() ? "text" : "password"}
													class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300 w-full pr-12"
													value={confirmPassword()}
													onInput={(e) => setConfirmPassword(e.target.value)}
													onKeyDown={(e) => e.key === "Enter" && goNext()}
													required
													minLength={10}
													maxLength={128}
												/>
											</div>
										</div>
									</Motion.div>
								</Match>

								<Match when={step() === 6}>
									<Motion.div
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										class="flex flex-col gap-4"
									>
										<h2 class="text-[color:var(--text-primary)] text-3xl font-bold tracking-tight">
											{t("auth", "step6Title")}
										</h2>
										<p class="text-[color:var(--text-secondary)] mb-4">
											{t("auth", "step6Desc")}
										</p>

										<div class="flex flex-col gap-1.5 p-1">
											<label
												for="verification_code"
												class="text-[color:var(--text-secondary)] text-xs font-semibold tracking-wider ml-1 uppercase"
											>
												{t("auth", "verificationCode")}
											</label>
											<input
												id="verification_code"
												type="text"
												inputMode="numeric"
												pattern="\d{6}"
												maxLength={6}
												class="bg-[color:var(--field-bg)] text-[color:var(--text-primary)] placeholder-[color:var(--field-placeholder)] p-3.5 rounded-xl border border-[color:var(--field-border)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)] focus:ring-2 focus:ring-[color:var(--field-ring)] outline-none transition-all duration-300"
												value={verificationCode()}
												onInput={(e) =>
													setVerificationCode(
														e.target.value.replace(/\D/g, "").slice(0, 6),
													)
												}
												onKeyDown={(e) => e.key === "Enter" && goNext()}
												required
												autofocus
											/>
										</div>

										<button
											type="button"
											onClick={resendVerificationCode}
											disabled={loading()}
											class="w-full bg-transparent hover:bg-[color:var(--button-secondary-hover)] border border-[color:var(--button-secondary-border)] text-[color:var(--button-secondary-text)] font-bold p-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{t("auth", "resendCodeBtn")}
										</button>
									</Motion.div>
								</Match>
							</Switch>

							<button
								type="button"
								onClick={goNext}
								disabled={loading()}
								class="w-full bg-[color:var(--button-primary-bg)] flex items-center justify-center gap-2 hover:bg-[color:var(--button-primary-hover)] text-[color:var(--button-primary-text)] font-bold p-4 rounded-xl mt-8 transition-all duration-300 shadow-lg hover:shadow-[0_8px_24px_var(--button-primary-shadow)] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{loading()
									? t("auth", "loadingBtn")
									: step() === 5
										? t("auth", "createBtn")
										: step() === 6
											? t("auth", "finishBtn")
											: t("auth", "nextBtn")}
								{!loading() && step() < 6 && <ArrowRight size={20} />}
							</button>
						</div>
					</Match>
				</Switch>
			</Motion.div>
		</div>
	);
}
