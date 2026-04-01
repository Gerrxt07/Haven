import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [solidPlugin()],
	test: {
		environment: "jsdom",
		globals: true,
		transformMode: { web: [/\.[jt]sx?$/] },
		setupFiles: ["./vitest.setup.ts"],
		deps: { registerNodeLoader: true },
	},
});
