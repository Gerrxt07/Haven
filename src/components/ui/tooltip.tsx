import { Tooltip as TooltipPrimitive } from "@kobalte/core";
import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { Motion } from "solid-motionone";
import { cn } from "../../lib/utils";

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = (
	props: ComponentProps<typeof TooltipPrimitive.Content>,
) => {
	const [local, others] = splitProps(props, ["class", "children"]);
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				class={cn(
					"z-50 overflow-hidden rounded-md bg-[color:var(--tooltip-bg)] px-3 py-1.5 text-[13px] font-semibold text-[color:var(--tooltip-text)] shadow-lg",
					local.class,
				)}
				{...others}
			>
				<Motion.div
					initial={{ opacity: 0, scale: 0.95, y: -2 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: -2 }}
					transition={{ duration: 0.15, easing: "ease-out" }}
				>
					{local.children}
					<TooltipPrimitive.Arrow class="fill-[color:var(--tooltip-bg)]" />
				</Motion.div>
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
};
