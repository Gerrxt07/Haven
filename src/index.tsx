import { render } from "solid-js/web";
import App from "./App";
import "./style.css";

const root = document.getElementById("app");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
	throw new Error("Root element not found.");
}

render(() => <App />, root as HTMLElement);
