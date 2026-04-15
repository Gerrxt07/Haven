import { resolve } from "node:path";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	experimental: {
		rolldown: true,
	},
	server: {
		host: "0.0.0.0",
		port: 1420,
		strictPort: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	plugins: [solidPlugin()],
});
