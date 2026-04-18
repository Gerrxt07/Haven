import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, nativeImage } from "electron";
import log from "electron-log/main";
import { autoUpdater } from "electron-updater";

export type UpdateChannelCandidate = "release" | "nightly";

/**
 * Build-time release channel. This is set during the build process via HAVEN_RELEASE_CHANNEL env var.
 * - "nightly" for nightly builds (checks for prerelease updates)
 * - "release" for stable releases (checks for stable updates only)
 */
export const buildTimeReleaseChannel: UpdateChannelCandidate =
	typeof __HAVEN_RELEASE_CHANNEL__ !== "undefined"
		? __HAVEN_RELEASE_CHANNEL__
		: "nightly";

const updateSettingsPath = path.join(
	app.getPath("userData"),
	"update-settings.json",
);
const updateCheckTimeoutMs = 10_000;
const downloadProgressUiThrottleMs = 120;
const downloadProgressLogThrottleMs = 900;
const devUpdaterPreviewDurationMs = 2_500;
const packagedMinimumUiDurationMs = 2_500;
const updaterLoaderSizePx = 160;
const updaterLogoSizePx = 116;

type UpdaterUiState = {
	phase: "checking" | "downloading" | "installing";
	percent?: number;
	transferred?: number;
	total?: number;
	bytesPerSecond?: number;
};

function isDevUpdaterPreviewEnabled(): boolean {
	return process.env.HAVEN_DEV_UPDATER_UI === "1";
}

type StartupUpdateFlowOptions = {
	iconPath: string;
	onReadyToLaunch: () => void;
};

function isStartupUpdateEnabled(): boolean {
	if (isDevUpdaterPreviewEnabled()) {
		return true;
	}

	return app.isPackaged && !process.env.VITE_DEV_SERVER_URL;
}

function toImageMimeType(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();

	if (extension === ".png") {
		return "image/png";
	}

	if (extension === ".jpg" || extension === ".jpeg") {
		return "image/jpeg";
	}

	if (extension === ".webp") {
		return "image/webp";
	}

	if (extension === ".svg") {
		return "image/svg+xml";
	}

	if (extension === ".ico") {
		return "image/x-icon";
	}

	if (extension === ".icns") {
		return "image/icns";
	}

	return "image/png";
}

function createUpdateWindow(
	iconPath: string,
	logoDataUrl: string,
): BrowserWindow {
	const updateWindow = new BrowserWindow({
		width: 400,
		height: 400,
		show: false,
		resizable: false,
		maximizable: false,
		minimizable: false,
		fullscreenable: false,
		closable: false,
		frame: false,
		autoHideMenuBar: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		title: "Haven Updater",
		backgroundColor: "#272727",
		icon: iconPath,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			partition: "updater",
		},
	});

	const updateHtml = `
		<!doctype html>
		<html lang="de">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Haven Updater</title>
				<style>
					:root { color-scheme: dark; }
					* { box-sizing: border-box; }
					html,
					body {
						width: 100%;
						height: 100%;
					}
					body {
						margin: 0;
						font-family: Inter, Segoe UI, system-ui, -apple-system, sans-serif;
						background: #272727;
						overflow: hidden;
					}
					.loader-wrap {
						position: fixed;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						width: ${updaterLoaderSizePx}px;
						height: ${updaterLoaderSizePx}px;
						display: grid;
						place-items: center;
						pointer-events: none;
					}
					.logo {
						width: ${updaterLogoSizePx}px;
						height: ${updaterLogoSizePx}px;
						object-fit: contain;
						border-radius: 12px;
						user-select: none;
						-webkit-user-drag: none;
					}
					.spinner {
						position: absolute;
						inset: 0;
						border: 4px solid rgba(255, 255, 255, 0.22);
						border-top-color: #ffffff;
						border-right-color: rgba(255, 255, 255, 0.85);
						border-radius: 50%;
						animation: spin 1s linear infinite;
						will-change: transform;
					}
					.progress-shell {
						position: fixed;
						left: 0;
						right: 0;
						bottom: 0;
						opacity: 0;
						transform: translateY(10px);
						transition: opacity 180ms ease, transform 240ms ease;
						pointer-events: none;
					}
					.progress-shell.visible {
						opacity: 1;
						transform: translateY(0);
					}
					.progress-track {
						height: 4px;
						background: rgba(255, 255, 255, 0.12);
						overflow: hidden;
					}
					.progress-bar {
						height: 100%;
						width: 0%;
						background: linear-gradient(90deg, #6d79ff 0%, #8f6dff 60%, #b36dff 100%);
						transition: width 180ms linear;
						position: relative;
						will-change: width;
					}
					.progress-bar::after {
						content: "";
						position: absolute;
						inset: 0;
						background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.42) 45%, transparent 75%);
						animation: shimmer 1.3s linear infinite;
					}
					.progress-meta {
						display: flex;
						justify-content: space-between;
						align-items: center;
						gap: 12px;
						padding: 8px 12px 10px;
						font-size: 12px;
						color: rgba(255, 255, 255, 0.8);
						letter-spacing: 0.01em;
					}
					@keyframes shimmer {
						0% { transform: translateX(-150%); }
						100% { transform: translateX(160%); }
					}
					@keyframes spin {
						to {
							transform: rotate(360deg);
						}
					}
				</style>
			</head>
			<body>
				<div class="loader-wrap" aria-label="Loading update">
					<img class="logo" src="${logoDataUrl}" alt="Haven" />
					<div class="spinner" aria-hidden="true"></div>
				</div>
				<div id="progress-shell" class="progress-shell" aria-hidden="true">
					<div class="progress-track">
						<div id="progress-bar" class="progress-bar"></div>
					</div>
					<div class="progress-meta">
						<span id="progress-status">Preparing update...</span>
						<span id="progress-text">0%</span>
					</div>
				</div>
				<script>
					(() => {
						const progressShell = document.getElementById("progress-shell");
						const progressBar = document.getElementById("progress-bar");
						const progressStatus = document.getElementById("progress-status");
						const progressText = document.getElementById("progress-text");

						const clampPercent = (value) => {
							if (typeof value !== "number" || Number.isNaN(value)) return 0;
							return Math.max(0, Math.min(100, value));
						};

						const formatBytes = (bytes) => {
							if (typeof bytes !== "number" || bytes <= 0) return "0 B";
							const units = ["B", "KB", "MB", "GB"];
							let size = bytes;
							let unitIndex = 0;
							while (size >= 1024 && unitIndex < units.length - 1) {
								size /= 1024;
								unitIndex += 1;
							}
							return size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1) + " " + units[unitIndex];
						};

						window.__havenUpdater = {
							update(payload) {
								if (!payload || !progressShell || !progressBar || !progressStatus || !progressText) {
									return;
								}

								const phase = payload.phase;
								const percent = clampPercent(payload.percent ?? 0);

								if (phase === "downloading" || phase === "installing") {
									progressShell.classList.add("visible");
								} else {
									progressShell.classList.remove("visible");
								}

								progressBar.style.width = percent.toFixed(1) + "%";

								if (phase === "downloading") {
									progressStatus.textContent = "Downloading update...";
									const transferred = formatBytes(payload.transferred ?? 0);
									const total = formatBytes(payload.total ?? 0);
									progressText.textContent = percent.toFixed(1) + "% · " + transferred + " / " + total;
									return;
								}

								if (phase === "installing") {
									progressStatus.textContent = "Installing update...";
									progressText.textContent = "100%";
									return;
								}

								progressStatus.textContent = "Checking for updates...";
								progressText.textContent = "0%";
							},
						};
					})();
				</script>
			</body>
		</html>
	`;

	updateWindow.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(updateHtml)}`,
	);

	updateWindow.once("ready-to-show", () => {
		updateWindow.show();
	});

	return updateWindow;
}

function updateUpdaterWindowState(
	updateWindow: BrowserWindow,
	state: UpdaterUiState,
): void {
	if (updateWindow.isDestroyed() || updateWindow.webContents.isDestroyed()) {
		return;
	}

	const payload = JSON.stringify(state);
	void updateWindow.webContents
		.executeJavaScript(
			`;
window.__havenUpdater?.update?.(${payload});
`,
			true,
		)
		.catch((error) => {
			log.debug("Failed to push updater UI state", error);
		});
}

function resizeLogoDataUrl(logoDataUrl: string): string {
	const image = nativeImage.createFromDataURL(logoDataUrl);

	if (image.isEmpty()) {
		return logoDataUrl;
	}

	return image
		.resize({
			width: updaterLogoSizePx,
			height: updaterLogoSizePx,
			quality: "best",
		})
		.toDataURL();
}

function logoDataUrlFromBuffer(iconBuffer: Buffer): string {
	const image = nativeImage.createFromBuffer(iconBuffer);

	if (image.isEmpty()) {
		return "";
	}

	return image
		.resize({
			width: updaterLogoSizePx,
			height: updaterLogoSizePx,
			quality: "best",
		})
		.toDataURL();
}

export async function getUpdateChannelCandidate(): Promise<UpdateChannelCandidate> {
	try {
		const raw = await fs.readFile(updateSettingsPath, "utf-8");
		const parsed: unknown = JSON.parse(raw);

		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"candidate" in parsed &&
			(parsed.candidate === "release" || parsed.candidate === "nightly")
		) {
			return parsed.candidate;
		}
	} catch {
		// Fallback to build-time channel
	}

	return buildTimeReleaseChannel;
}

export async function setUpdateChannelCandidate(
	candidate: UpdateChannelCandidate,
): Promise<boolean> {
	if (candidate !== "release" && candidate !== "nightly") {
		return false;
	}

	try {
		await fs.writeFile(
			updateSettingsPath,
			JSON.stringify({ candidate }, null, 2),
			"utf-8",
		);

		return true;
	} catch (error) {
		log.error("Failed to persist update channel candidate", error);
		return false;
	}
}

export async function runStartupUpdateFlow({
	iconPath,
	onReadyToLaunch,
}: StartupUpdateFlowOptions): Promise<void> {
	if (!isStartupUpdateEnabled()) {
		onReadyToLaunch();
		return;
	}

	let logoDataUrl =
		"data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCcgdmlld0JveD0nMCAwIDY0IDY0Jz48cmVjdCB3aWR0aD0nNjQnIGhlaWdodD0nNjQnIHJ4PScxNCcgZmlsbD0nIzM2MzYzNicvPjx0ZXh0IHg9JzMyJyB5PSczOScgZm9udC1mYW1pbHk9J1NlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZicgZm9udC1zaXplPSczMScgZm9udC13ZWlnaHQ9JzcwMCcgZmlsbD0nd2hpdGUnIHRleHQtYW5jaG9yPSdtaWRkbGUnPkg8L3RleHQ+PC9zdmc+";

	try {
		const iconBuffer = await fs.readFile(iconPath);
		const resizedFromBuffer = logoDataUrlFromBuffer(iconBuffer);
		if (resizedFromBuffer) {
			logoDataUrl = resizedFromBuffer;
		} else {
			const iconMimeType = toImageMimeType(iconPath);
			logoDataUrl = `data:${iconMimeType};base64,${iconBuffer.toString("base64")}`;
		}
	} catch (error) {
		log.warn("Could not read updater icon; using fallback logo", error);
	}

	logoDataUrl = resizeLogoDataUrl(logoDataUrl);

	const updateWindow = createUpdateWindow(iconPath, logoDataUrl);

	if (isDevUpdaterPreviewEnabled()) {
		log.initialize();
		log.transports.file.level = "info";
		log.info("Updater UI dev preview enabled");

		setTimeout(() => {
			onReadyToLaunch();
			if (!updateWindow.isDestroyed()) {
				updateWindow.destroy();
			}
		}, devUpdaterPreviewDurationMs);

		return;
	}

	const candidate = await getUpdateChannelCandidate();

	log.initialize();
	log.transports.file.level = "info";
	autoUpdater.logger = log;
	log.info("Updater startup flow initialized", {
		candidate,
		buildTimeReleaseChannel,
	});

	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.channel = candidate;
	autoUpdater.allowPrerelease = candidate === "nightly";
	autoUpdater.allowDowngrade = candidate === "nightly";
	autoUpdater.disableDifferentialDownload = false;
	autoUpdater.disableWebInstaller = false;

	let launched = false;
	let checkTimeout: NodeJS.Timeout | null = null;
	let lastUiProgressAt = 0;
	let lastLoggedProgressAt = 0;
	const uiStartedAt = Date.now();
	const minimumUiDurationMs = app.isPackaged ? packagedMinimumUiDurationMs : 0;

	const clearCheckTimeout = () => {
		if (!checkTimeout) {
			return;
		}

		clearTimeout(checkTimeout);
		checkTimeout = null;
	};

	const launchMainApp = () => {
		if (launched) {
			return;
		}

		launched = true;
		clearCheckTimeout();

		autoUpdater.removeAllListeners();
		onReadyToLaunch();

		const elapsedMs = Date.now() - uiStartedAt;
		const remainingMs = Math.max(0, minimumUiDurationMs - elapsedMs);
		setTimeout(() => {
			if (!updateWindow.isDestroyed()) {
				updateWindow.destroy();
			}
			log.info("Launching main app window", {
				elapsedMs,
				minimumUiDurationMs,
			});
		}, remainingMs);
	};

	checkTimeout = setTimeout(() => {
		log.warn("Update check timed out; launching app");
		launchMainApp();
	}, updateCheckTimeoutMs);

	autoUpdater.on("checking-for-update", () => {
		log.info("Checking for updates");
		updateUpdaterWindowState(updateWindow, { phase: "checking", percent: 0 });
	});

	autoUpdater.on("update-available", (info) => {
		clearCheckTimeout();
		log.info("Update available; download started", {
			version: info.version,
			releaseDate: info.releaseDate,
		});
		updateUpdaterWindowState(updateWindow, {
			phase: "downloading",
			percent: 0,
			transferred: 0,
			total: 0,
			bytesPerSecond: 0,
		});
	});

	autoUpdater.on("download-progress", (progress) => {
		const now = Date.now();

		if (now - lastUiProgressAt >= downloadProgressUiThrottleMs) {
			lastUiProgressAt = now;
			updateUpdaterWindowState(updateWindow, {
				phase: "downloading",
				percent: progress.percent,
				transferred: progress.transferred,
				total: progress.total,
				bytesPerSecond: progress.bytesPerSecond,
			});
		}

		if (now - lastLoggedProgressAt >= downloadProgressLogThrottleMs) {
			lastLoggedProgressAt = now;
			log.info("Update download progress", {
				percent: progress.percent,
				bytesPerSecond: progress.bytesPerSecond,
				transferred: progress.transferred,
				total: progress.total,
			});
		}
	});

	autoUpdater.on("update-not-available", () => {
		clearCheckTimeout();
		log.info("No update available; launching app");
		launchMainApp();
	});

	autoUpdater.on("error", (error) => {
		clearCheckTimeout();
		log.error("Updater error; launching app", error);
		launchMainApp();
	});

	autoUpdater.on("update-downloaded", () => {
		clearCheckTimeout();
		log.info("Update downloaded; installing now");
		updateUpdaterWindowState(updateWindow, {
			phase: "installing",
			percent: 100,
		});
		setTimeout(() => {
			autoUpdater.quitAndInstall(false, true);
		}, 900);
	});

	try {
		log.info("Triggering autoUpdater.checkForUpdates()");
		await autoUpdater.checkForUpdates();
	} catch (error) {
		clearCheckTimeout();
		log.error("checkForUpdates failed; launching app", error);
		launchMainApp();
	}
}
