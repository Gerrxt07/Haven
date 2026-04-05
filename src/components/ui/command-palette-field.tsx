import { Command, type LucideIcon, Search } from "lucide-solid";
import {
	type ComponentProps,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion } from "solid-motionone";
import { t } from "../../i18n";
import { cn } from "../../lib/utils";

export type CommandPaletteAction = {
	id: string;
	label: string;
	description: string;
	shortcut: string;
	icon: LucideIcon;
	run: () => void | Promise<void>;
};

type CommandPaletteFieldProps = {
	isOpen: boolean;
	buttonRef?: (element: HTMLButtonElement) => void;
	onOpen: () => void;
};

type CommandPaletteProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actions: CommandPaletteAction[];
};

export function CommandPaletteField(props: CommandPaletteFieldProps) {
	const [isPressed, setIsPressed] = createSignal(false);

	return (
		<Motion.button
			ref={props.buttonRef}
			type="button"
			aria-label={t("app", "commandPalette")}
			aria-haspopup="dialog"
			aria-expanded={props.isOpen}
			onClick={() => props.onOpen()}
			class="h-6 min-w-42 max-w-56 px-2.5 mr-1 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--field-bg)] text-[color:var(--text-tertiary)] flex items-center gap-2 transition-colors duration-200 hover:bg-[color:var(--field-bg-focus)]"
			animate={{
				scale: isPressed() ? 0.98 : props.isOpen ? 1.02 : 1,
				backgroundColor: props.isOpen
					? "var(--field-bg-focus)"
					: "var(--field-bg)",
				boxShadow: props.isOpen
					? "var(--shadow-float)"
					: "0 0 0 0 rgba(0,0,0,0)",
			}}
			transition={{ duration: 0.18, easing: "ease-out" }}
			onPointerDown={() => setIsPressed(true)}
			onPointerUp={() => setIsPressed(false)}
			onPointerLeave={() => setIsPressed(false)}
			onBlur={() => setIsPressed(false)}
		>
			<Search size={12} stroke-width={2} aria-hidden="true" />
			<span class="text-[11px] font-medium truncate flex-1 text-left">
				{t("app", "commandPalette")}
			</span>
			<span class="flex items-center gap-1 text-[10px] font-semibold text-[color:var(--text-tertiary)]">
				<span class="min-w-5 h-4 px-1 rounded-sm border border-[color:var(--keycap-border)] bg-[color:var(--keycap-bg)] text-[color:var(--keycap-text)] inline-flex items-center justify-center leading-none shadow-[var(--keycap-shadow)]">
					Ctrl
				</span>
				<span class="min-w-4 h-4 px-1 rounded-sm border border-[color:var(--keycap-border)] bg-[color:var(--keycap-bg)] text-[color:var(--keycap-text)] inline-flex items-center justify-center leading-none shadow-[var(--keycap-shadow)]">
					K
				</span>
			</span>
		</Motion.button>
	);
}

function CommandPaletteInput(
	props: ComponentProps<"input"> & {
		inputRef?: (el: HTMLInputElement) => void;
	},
) {
	const [local, others] = splitProps(props, ["class", "inputRef"]);

	return (
		<input
			ref={local.inputRef}
			{...others}
			class={cn(
				"h-12 w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--field-bg)] px-12 pr-4 text-[14px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--field-border-focus)] focus:bg-[color:var(--field-bg-focus)]",
				local.class,
			)}
		/>
	);
}

export function CommandPalette(props: CommandPaletteProps) {
	let inputRef: HTMLInputElement | undefined;
	const [query, setQuery] = createSignal("");

	const filteredActions = createMemo(() => {
		const normalizedQuery = query().trim().toLowerCase();
		if (!normalizedQuery) {
			return props.actions;
		}

		return props.actions.filter((action) => {
			const haystack =
				`${action.label} ${action.description} ${action.shortcut}`.toLowerCase();
			return haystack.includes(normalizedQuery);
		});
	});

	const quickActions = createMemo(() => filteredActions().slice(0, 4));
	const otherActions = createMemo(() => filteredActions().slice(4));

	createEffect(() => {
		if (!props.open) {
			setQuery("");
			if (inputRef) {
				inputRef.value = "";
			}
			return;
		}

		queueMicrotask(() => {
			inputRef?.focus();
			inputRef?.select();
		});
	});

	createEffect(() => {
		if (!props.open) {
			return;
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				props.onOpenChange(false);
			}
		};

		globalThis.addEventListener("keydown", onKeyDown);
		onCleanup(() => globalThis.removeEventListener("keydown", onKeyDown));
	});

	const runAction = async (action: CommandPaletteAction) => {
		props.onOpenChange(false);
		await action.run();
	};

	return (
		<Portal>
			<div class="fixed inset-0 z-[120]">
				<Motion.button
					type="button"
					aria-label={t("app", "commandPaletteClose")}
					tabIndex={props.open ? 0 : -1}
					class={cn(
						"absolute inset-0 border-none bg-[image:var(--command-overlay)] p-0 backdrop-blur-[2px]",
						props.open ? "pointer-events-auto" : "pointer-events-none",
					)}
					initial={false}
					animate={{
						opacity: props.open ? 1 : 0,
						backdropFilter: props.open ? "blur(6px)" : "blur(0px)",
					}}
					transition={{ duration: 0.24, easing: [0.22, 1, 0.36, 1] }}
					onClick={() => props.onOpenChange(false)}
				/>

				<div class="absolute inset-0 flex items-start justify-center px-4 pt-18 pointer-events-none">
					<Motion.div
						initial={false}
						animate={{
							opacity: props.open ? 1 : 0,
							scale: props.open ? 1 : 0.975,
							y: props.open ? 0 : -24,
							filter: props.open
								? "saturate(1) blur(0px)"
								: "saturate(0.9) blur(10px)",
						}}
						transition={{
							duration: 0.3,
							easing: [0.22, 1, 0.36, 1],
						}}
						class={cn(
							"w-full max-w-2xl origin-top overflow-hidden rounded-[28px] border border-[color:var(--command-border)] bg-[color:var(--command-bg)] shadow-[var(--shadow-command)] backdrop-blur-2xl",
							props.open ? "pointer-events-auto" : "pointer-events-none",
						)}
						onClick={(event) => event.stopPropagation()}
					>
						<Motion.div
							initial={false}
							animate={{
								opacity: props.open ? 1 : 0,
								y: props.open ? 0 : -10,
							}}
							transition={{
								duration: 0.24,
								delay: props.open ? 0.04 : 0,
								easing: [0.22, 1, 0.36, 1],
							}}
							class="relative border-b border-[color:var(--border-subtle)] px-4 py-4"
						>
							<Search
								size={16}
								stroke-width={2}
								aria-hidden="true"
								class="absolute left-8 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)]"
							/>
							<CommandPaletteInput
								inputRef={(element) => {
									inputRef = element;
								}}
								type="text"
								placeholder={t("app", "commandPaletteSearchPlaceholder")}
								tabIndex={props.open ? 0 : -1}
								onInput={(event) => {
									setQuery(event.currentTarget.value);
								}}
								onKeyDown={(event) => {
									if (event.key !== "Enter") {
										return;
									}

									const firstAction = filteredActions()[0];
									if (!firstAction) {
										return;
									}

									event.preventDefault();
									void runAction(firstAction);
								}}
							/>
						</Motion.div>

						<Motion.div
							initial={false}
							animate={{
								opacity: props.open ? 1 : 0,
								y: props.open ? 0 : 10,
							}}
							transition={{
								duration: 0.26,
								delay: props.open ? 0.07 : 0,
								easing: [0.22, 1, 0.36, 1],
							}}
							class="px-3 py-3"
						>
							<Show
								when={filteredActions().length > 0}
								fallback={
									<div class="rounded-2xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)] px-4 py-8 text-center">
										<div class="text-[14px] font-semibold text-[color:var(--text-primary)]">
											{t("app", "commandPaletteNoResults")}
										</div>
										<div class="mt-1 text-[12px] text-[color:var(--text-tertiary)]">
											{t("app", "commandPaletteNoResultsHint")}
										</div>
									</div>
								}
							>
								<div class="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
									<span>{t("app", "commandPaletteQuickActions")}</span>
									<span>{filteredActions().length}</span>
								</div>

								<div class="space-y-2">
									<For each={quickActions()}>
										{(action, index) => (
											<Motion.button
												type="button"
												tabIndex={props.open ? 0 : -1}
												class="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[color:var(--surface-subtle)] px-4 py-3 text-left transition-colors duration-150 hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--field-bg-focus)]"
												initial={false}
												animate={{
													opacity: props.open ? 1 : 0,
													y: props.open ? 0 : 10,
												}}
												transition={{
													duration: 0.22,
													delay: props.open ? 0.08 + index() * 0.04 : 0,
													easing: [0.22, 1, 0.36, 1],
												}}
												onClick={() => {
													void runAction(action);
												}}
											>
												<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--command-icon-bg)] text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
													<action.icon
														size={18}
														stroke-width={2}
														aria-hidden="true"
													/>
												</div>
												<div class="min-w-0 flex-1">
													<div class="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">
														{action.label}
													</div>
													<div class="truncate text-[12px] text-[color:var(--text-tertiary)]">
														{action.description}
													</div>
												</div>
												<Show when={action.shortcut}>
													<div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--command-shortcut-bg)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-tertiary)]">
														{action.shortcut}
													</div>
												</Show>
											</Motion.button>
										)}
									</For>
								</div>

								<Show when={otherActions().length > 0}>
									<div class="mt-4 mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
										<span>{t("app", "commandPaletteOtherActions")}</span>
										<span>{otherActions().length}</span>
									</div>
									<div class="max-h-[30vh] overflow-y-auto pr-1 space-y-2">
										<For each={otherActions()}>
											{(action, index) => (
												<Motion.button
													type="button"
													tabIndex={props.open ? 0 : -1}
													class="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[color:var(--surface-subtle)] px-4 py-3 text-left transition-colors duration-150 hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--field-bg-focus)]"
													initial={false}
													animate={{
														opacity: props.open ? 1 : 0,
														y: props.open ? 0 : 10,
													}}
													transition={{
														duration: 0.22,
														delay: props.open ? 0.16 + index() * 0.02 : 0,
														easing: [0.22, 1, 0.36, 1],
													}}
													onClick={() => {
														void runAction(action);
													}}
												>
													<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--command-icon-bg)] text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
														<action.icon
															size={18}
															stroke-width={2}
															aria-hidden="true"
														/>
													</div>
													<div class="min-w-0 flex-1">
														<div class="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">
															{action.label}
														</div>
														<div class="truncate text-[12px] text-[color:var(--text-tertiary)]">
															{action.description}
														</div>
													</div>
													<Show when={action.shortcut}>
														<div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--command-shortcut-bg)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-tertiary)]">
															{action.shortcut}
														</div>
													</Show>
												</Motion.button>
											)}
										</For>
									</div>
								</Show>
							</Show>
						</Motion.div>

						<Motion.div
							initial={false}
							animate={{
								opacity: props.open ? 1 : 0,
								y: props.open ? 0 : 8,
							}}
							transition={{
								duration: 0.24,
								delay: props.open ? 0.1 : 0,
								easing: [0.22, 1, 0.36, 1],
							}}
							class="flex items-center justify-between border-t border-[color:var(--border-subtle)] px-4 py-3 text-[11px] text-[color:var(--text-subtle)]"
						>
							<div class="flex items-center gap-2">
								<Command size={14} stroke-width={2} aria-hidden="true" />
								<span>{t("app", "commandPaletteFooter")}</span>
							</div>
							<div class="flex items-center gap-2">
								<kbd class="rounded border border-[color:var(--border-subtle)] bg-[color:var(--field-bg)] px-1.5 py-0.5 font-semibold text-[color:var(--text-primary)]">
									Esc
								</kbd>
								<span>{t("app", "commandPaletteClose")}</span>
							</div>
						</Motion.div>
					</Motion.div>
				</div>
			</div>
		</Portal>
	);
}
