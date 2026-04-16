import { resolve } from "node:path";
import type { ObfuscatorOptions } from "javascript-obfuscator";
import obfuscator from "rollup-plugin-obfuscator";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import solidPlugin from "vite-plugin-solid";

/**
 * Reserved names that must NOT be obfuscated to prevent breaking functionality:
 * - Context bridge API name: electronAPI
 * - IPC channel names used in main <-> renderer communication
 * - Exposed API methods from preload
 */
const RESERVED_NAMES = [
	// Context bridge API name
	"electronAPI",
	// Window control IPC channels
	"window-minimize",
	"window-maximize",
	"window-close",
	"get-window-state",
	"window-state-changed",
	// Secure storage IPC channels
	"secure-store-token",
	"secure-load-token",
	"secure-delete-token",
	"secure-store-set",
	"secure-store-get",
	"secure-store-delete",
	// External link IPC channels
	"show-external-link-warning",
	"confirm-open-url",
	// Updater IPC channels
	"updater-get-candidate",
	"updater-set-candidate",
	// Logging IPC channels
	"write-detailed-log",
	// Email validation IPC channels
	"validate-email-domain",
	// Exposed API methods (properties of electronAPI)
	"minimize",
	"maximize",
	"close",
	"getWindowState",
	"onWindowStateChanged",
	"writeDetailedLog",
	"storeToken",
	"loadToken",
	"deleteToken",
	"secureStoreSet",
	"secureStoreGet",
	"secureStoreDelete",
	"onExternalLinkWarning",
	"confirmOpenUrl",
	"getUpdateCandidate",
	"setUpdateCandidate",
	"validateEmailDomain",
	// Global updater window method
	"__havenUpdater",
	"update",
];

/**
 * Base obfuscation options - High security, reserved names protected
 */
const baseObfuscationOptions: ObfuscatorOptions = {
	compact: true,
	controlFlowFlattening: true,
	controlFlowFlatteningThreshold: 0.75,
	deadCodeInjection: true,
	deadCodeInjectionThreshold: 0.4,
	debugProtection: true,
	debugProtectionInterval: 2000,
	disableConsoleOutput: true,
	identifierNamesGenerator: "hexadecimal",
	numbersToExpressions: true,
	renameGlobals: false, // Keep globals to avoid issues
	reservedNames: RESERVED_NAMES.map((name) => `^${name}$`).join("|"),
	reservedStrings: RESERVED_NAMES,
	rotateStringArray: true,
	selfDefending: true,
	shuffleStringArray: true,
	simplify: true,
	stringArray: true,
	stringArrayEncoding: ["base64", "rc4"],
	stringArrayThreshold: 0.75,
	transformObjectKeys: true,
	unicodeEscapeSequence: false,
};

/**
 * Main process obfuscation - Can be more aggressive
 */
const mainObfuscationOptions: ObfuscatorOptions = {
	...baseObfuscationOptions,
	// Main process has no context bridge constraints, can be more aggressive
	deadCodeInjectionThreshold: 0.5,
	controlFlowFlatteningThreshold: 0.85,
	stringArrayThreshold: 0.85,
};

/**
 * Preload script obfuscation - Conservative to preserve context bridge API
 */
const preloadObfuscationOptions: ObfuscatorOptions = {
	...baseObfuscationOptions,
	// More conservative for preload to ensure context bridge works
	controlFlowFlatteningThreshold: 0.5,
	deadCodeInjectionThreshold: 0.3,
	stringArrayThreshold: 0.6,
	// Keep object keys that might be accessed externally
	transformObjectKeys: false,
};

/**
 * Renderer process obfuscation - Full protection
 */
const rendererObfuscationOptions: ObfuscatorOptions = {
	compact: true,
	controlFlowFlattening: true,
	controlFlowFlatteningThreshold: 0.8,
	deadCodeInjection: true,
	deadCodeInjectionThreshold: 0.5,
	debugProtection: true,
	disableConsoleOutput: true,
	identifierNamesGenerator: "hexadecimal",
	numbersToExpressions: true,
	renameGlobals: false,
	rotateStringArray: true,
	selfDefending: true,
	shuffleStringArray: true,
	simplify: true,
	stringArray: true,
	stringArrayEncoding: ["base64", "rc4"],
	stringArrayThreshold: 0.8,
	transformObjectKeys: true,
	unicodeEscapeSequence: false,
	// Reserved names that might be called from outside
	reservedNames: ["electronAPI", "__havenUpdater"]
		.map((name) => `^${name}$`)
		.join("|"),
};

export default defineConfig(({ mode }) => ({
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
							plugins: [
								obfuscator({
									options: mainObfuscationOptions,
									include: ["**/*.js"],
									exclude: ["node_modules/**"],
								}),
							],
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
							plugins: [
								obfuscator({
									options: preloadObfuscationOptions,
									include: ["**/*.js"],
									exclude: ["node_modules/**"],
								}),
							],
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
		// Renderer process obfuscation (only in production)
		...(mode === "production"
			? [
					obfuscator({
						options: rendererObfuscationOptions,
						include: ["**/*.js"],
						exclude: ["node_modules/**"],
					}),
				]
			: []),
	].filter(Boolean),
}));
