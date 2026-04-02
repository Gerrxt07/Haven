import { QueryClientProvider } from "@tanstack/solid-query";
import { render } from "solid-js/web";
import App from "./App";
import { queryClient } from "./lib/query/client";
import { initRuntimeServices } from "./lib/runtime/init";
import "./style.css";

const root = document.getElementById("app");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
	throw new Error("Root element not found.");
}

render(
	() => (
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	),
	root as HTMLElement,
);

void initRuntimeServices().catch((error: unknown) => {
	console.error("runtime service initialization failed", error);
});
