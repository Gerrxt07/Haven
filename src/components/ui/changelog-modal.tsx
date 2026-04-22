import { ArrowUpRight, Sparkles } from "lucide-solid";
import { For, onCleanup, onMount, Show } from "solid-js";
import { t, tf } from "../../i18n";
import type { ChangelogEntry } from "../../lib/changelog";

interface ChangelogModalProps {
	open: boolean;
	fromVersion: string;
	toVersion: string;
	entries: ChangelogEntry[];
	source: "compare" | "latest";
	fallbackUrl: string;
	onAcknowledge: () => void;
}

export function ChangelogModal(props: ChangelogModalProps) {
	onMount(() => {
		const onEscape = (event: KeyboardEvent) => {
			if (!props.open || event.key !== "Escape") {
				return;
			}

			props.onAcknowledge();
		};

		globalThis.addEventListener("keydown", onEscape);
		onCleanup(() => globalThis.removeEventListener("keydown", onEscape));
	});

	return (
		<Show when={props.open}>
			<div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="changelog-title"
					class="w-full max-w-2xl overflow-hidden rounded-3xl border border-(--border-strong) bg-(--surface-raised) shadow-[0_24px_68px_rgba(0,0,0,0.55)]"
				>
					<div class="relative overflow-hidden border-b border-(--border-subtle) bg-[linear-gradient(120deg,#0ea5e9_0%,#2563eb_46%,#0f172a_100%)] px-6 py-5 text-white">
						<div class="pointer-events-none absolute -top-10 right-0 h-28 w-28 rounded-full bg-white/25 blur-3xl" />
						<div class="pointer-events-none absolute -bottom-8 left-8 h-24 w-24 rounded-full bg-cyan-300/35 blur-3xl" />
						<div class="relative flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
							<Sparkles size={14} stroke-width={2.4} aria-hidden="true" />
							<span>{t("app", "changelogEyebrow")}</span>
						</div>
					</div>

					<div class="p-6">
						<h2
							id="changelog-title"
							class="text-2xl font-extrabold leading-tight"
						>
							{tf("app", "changelogTitle", {
								from: props.fromVersion,
								to: props.toVersion,
							})}
						</h2>
						<p class="mt-2 text-sm text-(--text-secondary)">
							{t("app", "changelogSummary")}
						</p>

						<Show when={props.source === "latest"}>
							<p class="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
								{t("app", "changelogFallback")}
							</p>
						</Show>

						<div class="mt-5 max-h-[22rem] overflow-y-auto rounded-2xl border border-(--border-subtle) bg-(--surface-subtle) p-3">
							<Show
								when={props.entries.length > 0}
								fallback={
									<div class="rounded-xl border border-(--border-subtle) bg-(--surface-secondary) px-3 py-3 text-sm text-(--text-secondary)">
										<p>{t("app", "changelogEmpty")}</p>
										<Show when={props.fallbackUrl.length > 0}>
											<button
												type="button"
												class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-(--border-strong) bg-(--surface-primary) px-3 py-2 text-xs font-semibold text-(--text-primary) transition-colors duration-150 hover:bg-(--surface-raised)"
												onClick={() =>
													globalThis.electronAPI.confirmOpenUrl(
														props.fallbackUrl,
													)
												}
											>
												{t("app", "changelogViewOnGitHub")}
												<ArrowUpRight
													size={14}
													stroke-width={2}
													aria-hidden="true"
												/>
											</button>
										</Show>
									</div>
								}
							>
								<div class="flex flex-col gap-2">
									<For each={props.entries}>
										{(entry) => (
											<button
												type="button"
												class="group block rounded-xl border border-(--border-subtle) bg-(--surface-secondary) px-3 py-3 transition-colors duration-150 hover:border-(--border-strong) hover:bg-(--surface-primary)"
												onClick={() =>
													globalThis.electronAPI.confirmOpenUrl(entry.url)
												}
											>
												<div class="flex items-start justify-between gap-3">
													<p class="text-sm font-semibold leading-snug text-(--text-primary)">
														{entry.summary}
													</p>
													<ArrowUpRight
														size={16}
														stroke-width={2}
														class="mt-0.5 shrink-0 text-(--text-tertiary) transition-colors duration-150 group-hover:text-(--text-primary)"
														aria-hidden="true"
													/>
												</div>
												<Show when={entry.details.length > 0}>
													<p class="mt-1 text-xs text-(--text-secondary)">
														{entry.details}
													</p>
												</Show>
												<p class="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-(--text-tertiary)">
													{entry.sha.slice(0, 7)}
												</p>
											</button>
										)}
									</For>
								</div>
							</Show>
						</div>

						<div class="mt-5 flex justify-end">
							<button
								type="button"
								class="rounded-xl border border-transparent bg-(--button-primary-bg) px-5 py-2.5 text-sm font-semibold text-(--button-primary-text) shadow-[0_8px_24px_var(--button-primary-shadow)] transition-colors duration-200 hover:bg-(--button-primary-hover)"
								onClick={() => props.onAcknowledge()}
							>
								{t("app", "changelogAcknowledge")}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
}
