import { Search } from "lucide-solid";
import { t } from "../../i18n";

export function CommandPaletteField() {
	return (
		<button
			type="button"
			aria-label={t("app", "commandPalette")}
			class="h-6 min-w-42 max-w-56 px-2.5 mr-1 rounded-md border border-white/10 bg-white/5 text-[#b5bac1] flex items-center gap-2 transition-colors duration-200 hover:bg-white/10"
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
		</button>
	);
}
