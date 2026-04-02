import { render } from "solid-js/web";
import App from "./App";
import { initRuntimeServices } from "./lib/runtime/init";
import "./style.css";

const root = document.getElementById("app");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
	throw new Error("Root element not found.");
}

render(() => <App />, root as HTMLElement);

void initRuntimeServices().catch((error: unknown) => {
	console.error("runtime service initialization failed", error);
});
