import { resolve } from "node:path";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	experimental: {
		rolldown: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@electron": resolve(__dirname, "./electron"),
		},
	},
	plugins: [
		solidPlugin(),
		electron([
			{
				entry: "electron/main.ts",
				vite: {
					build: {
						outDir: "dist-electron",
						minify: true,
						rollupOptions: {
							output: {
								format: "cjs",
							},
						},
					},
					resolve: {
						alias: {
							"@electron": resolve(__dirname, "./electron"),
						},
					},
				},
			},
			{
				entry: "electron/preload.ts",
				onstart(options) {
					options.reload();
				},
				vite: {
					build: {
						outDir: "dist-electron",
						minify: true,
						rollupOptions: {
							output: {
								format: "cjs",
							},
						},
					},
					resolve: {
						alias: {
							"@electron": resolve(__dirname, "./electron"),
						},
					},
				},
			},
		]),
	],
});
