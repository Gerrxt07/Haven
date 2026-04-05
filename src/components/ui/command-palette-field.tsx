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
			class="h-6 min-w-42 max-w-56 px-2.5 mr-1 rounded-md border border-white/10 bg-white/5 text-[#b5bac1] flex items-center gap-2 transition-colors duration-200 hover:bg-white/10"
			animate={{
				scale: isPressed() ? 0.98 : props.isOpen ? 1.02 : 1,
				backgroundColor: props.isOpen
					? "rgba(255,255,255,0.12)"
					: "rgba(255,255,255,0.05)",
				boxShadow: props.isOpen
					? "0 0 0 1px rgba(255,255,255,0.08), 0 10px 28px rgba(0,0,0,0.32)"
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
			<span class="flex items-center gap-1 text-[10px] font-semibold text-[#8e9297]">
				<span class="min-w-5 h-4 px-1 rounded-sm border border-white/18 bg-[#2b2d31] text-[#dcddde] inline-flex items-center justify-center leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.04)]">
					Ctrl
				</span>
				<span class="min-w-4 h-4 px-1 rounded-sm border border-white/18 bg-[#2b2d31] text-[#dcddde] inline-flex items-center justify-center leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.04)]">
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
				"h-12 w-full rounded-xl border border-white/8 bg-white/[0.04] px-12 pr-4 text-[14px] text-white outline-none placeholder:text-[#8b9098] focus:border-white/16 focus:bg-white/[0.06]",
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
			<div
				class={cn(
					"fixed inset-0 z-[120]",
					props.open ? "pointer-events-auto" : "pointer-events-none",
				)}
			>
				<Motion.button
					type="button"
					aria-label={t("app", "commandPaletteClose")}
					tabIndex={props.open ? 0 : -1}
					class="absolute inset-0 border-none bg-[radial-gradient(circle_at_top,rgba(112,126,148,0.26),rgba(7,9,12,0.88)_56%)] p-0 backdrop-blur-[2px]"
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
						class="pointer-events-auto w-full max-w-2xl origin-top overflow-hidden rounded-[28px] border border-white/10 bg-[#111317]/92 shadow-[0_30px_110px_rgba(0,0,0,0.58)] backdrop-blur-2xl"
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
							class="relative border-b border-white/8 px-4 py-4"
						>
							<Search
								size={16}
								stroke-width={2}
								aria-hidden="true"
								class="absolute left-8 top-1/2 -translate-y-1/2 text-[#8b9098]"
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
							class="max-h-[52vh] overflow-y-auto px-3 py-3"
						>
							<div class="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777d86]">
								<span>{t("app", "commandPaletteQuickActions")}</span>
								<span>{filteredActions().length}</span>
							</div>

							<Show
								when={filteredActions().length > 0}
								fallback={
									<div class="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
										<div class="text-[14px] font-semibold text-white">
											{t("app", "commandPaletteNoResults")}
										</div>
										<div class="mt-1 text-[12px] text-[#8b9098]">
											{t("app", "commandPaletteNoResultsHint")}
										</div>
									</div>
								}
							>
								<div class="space-y-2">
									<For each={filteredActions()}>
										{(action, index) => (
											<Motion.button
												type="button"
												tabIndex={props.open ? 0 : -1}
												class="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-4 py-3 text-left transition-colors duration-150 hover:border-white/10 hover:bg-white/[0.06]"
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
												<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1b2028] text-[#d4d8de] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
													<action.icon
														size={18}
														stroke-width={2}
														aria-hidden="true"
													/>
												</div>
												<div class="min-w-0 flex-1">
													<div class="truncate text-[14px] font-semibold text-white">
														{action.label}
													</div>
													<div class="truncate text-[12px] text-[#8b9098]">
														{action.description}
													</div>
												</div>
												<div class="rounded-lg border border-white/10 bg-[#151920] px-2 py-1 text-[11px] font-semibold text-[#aeb4bc]">
													{action.shortcut}
												</div>
											</Motion.button>
										)}
									</For>
								</div>
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
							class="flex items-center justify-between border-t border-white/8 px-4 py-3 text-[11px] text-[#7e848d]"
						>
							<div class="flex items-center gap-2">
								<Command size={14} stroke-width={2} aria-hidden="true" />
								<span>{t("app", "commandPaletteFooter")}</span>
							</div>
							<div class="flex items-center gap-2">
								<kbd class="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-semibold text-[#d5d9df]">
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
