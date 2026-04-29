import { resolve } from "node:path";
import type { ObfuscatorOptions } from "javascript-obfuscator";
import obfuscator from "rollup-plugin-obfuscator";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import solidPlugin from "vite-plugin-solid";

type ElectronDevStartupOptions = {
	startup: (argv?: string[]) => void;
	reload: () => void;
};

const electronDevArgs = ["."];

function startElectronDev(options: Pick<ElectronDevStartupOptions, "startup">) {
	options.startup(electronDevArgs);
}

function reloadElectronDev(options: ElectronDevStartupOptions) {
	if (process.electronApp) {
		options.reload();
		return;
	}

	startElectronDev(options);
}

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
	"load-changelog",
	// Secure storage IPC channels
	"secure-store-token",
	"secure-load-token",
	"secure-delete-token",
	"auth-store-tokens",
	"auth-load-tokens",
	"auth-delete-tokens",
	"e2ee-store-set",
	"e2ee-store-get",
	"e2ee-store-delete",
	"cache-store-set",
	"cache-store-get",
	"cache-store-delete",
	// External link IPC channels
	"show-external-link-warning",
	"confirm-open-url",
	// Updater IPC channels
	"updater-get-candidate",
	"updater-set-candidate",
	"updater-get-build-channel",
	// Logging IPC channels
	"write-detailed-log",
	// Email validation IPC channels
	"validate-email-domain",
	// Exposed API methods (properties of electronAPI)
	"minimize",
	"maximize",
	"close",
	"loadChangelog",
	"getWindowState",
	"onWindowStateChanged",
	"writeDetailedLog",
	"storeToken",
	"loadToken",
	"deleteToken",
	"storeAuthTokens",
	"loadAuthTokens",
	"deleteAuthTokens",
	"e2eeStoreSet",
	"e2eeStoreGet",
	"e2eeStoreDelete",
	"cacheStoreSet",
	"cacheStoreGet",
	"cacheStoreDelete",
	"onExternalLinkWarning",
	"confirmOpenUrl",
	"getUpdateCandidate",
	"setUpdateCandidate",
	"getBuildReleaseChannel",
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
	splitStrings: true,
	// Reserved names that might be called from outside
	reservedNames: ["electronAPI", "__havenUpdater"]
		.map((name) => `^${name}$`)
		.join("|"),
};

export default defineConfig(({ mode }) => ({
	experimental: {
		rolldown: true,
	},
	define: {
		__HAVEN_RELEASE_CHANNEL__: JSON.stringify(
			process.env.HAVEN_RELEASE_CHANNEL ?? "nightly",
		),
	},
	build: {
		rollupOptions: {
			output: {
				// Erstellt separate Dateien für große Bibliotheken
				manualChunks(id) {
					if (id.includes("node_modules")) {
						// Krypto separat halten (Sicherheit & Performance)
						if (
							id.includes("libsodium") ||
							id.includes("secure-remote-password")
						) {
							return "vendor-crypto";
						}
						// Framework-Kern separat
						if (id.includes("solid-js") || id.includes("@kobalte")) {
							return "vendor-framework";
						}
						// Alle anderen Abhängigkeiten in einen allgemeinen Vendor-Chunk
						return "vendor";
					}
				},
			},
		},
		// Nutzt den schnellen esbuild-Minifier für Produktion
		minify: mode === "production" ? "esbuild" : false,
		sourcemap: mode !== "production", // Deaktiviert Sourcemaps in Produktion für mehr Sicherheit
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
				onstart(options) {
					startElectronDev(options);
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
					reloadElectronDev(options);
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
