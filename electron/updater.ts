import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, nativeImage } from "electron";
import log from "electron-log/main";
import { autoUpdater } from "electron-updater";

export type UpdateChannelCandidate = "release" | "nightly";

const updateSettingsPath = path.join(
	app.getPath("userData"),
	"update-settings.json",
);
const updateCheckTimeoutMs = 10_000;
const devUpdaterPreviewDurationMs = 2_500;
const packagedMinimumUiDurationMs = 2_500;
const updaterLoaderSizePx = 160;
const updaterLogoSizePx = 116;

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
		// Fallback below
	}

	return "nightly";
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
	log.info("Updater startup flow initialized", { candidate });

	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.channel = candidate;
	autoUpdater.allowPrerelease = candidate === "nightly";
	autoUpdater.allowDowngrade = candidate === "nightly";
	autoUpdater.disableWebInstaller = true;

	let launched = false;
	let checkTimeout: NodeJS.Timeout | null = null;
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
	});

	autoUpdater.on("update-available", (info) => {
		clearCheckTimeout();
		log.info("Update available; download started", {
			version: info.version,
			releaseDate: info.releaseDate,
		});
	});

	autoUpdater.on("download-progress", (progress) => {
		log.info("Update download progress", {
			percent: progress.percent,
			bytesPerSecond: progress.bytesPerSecond,
			transferred: progress.transferred,
			total: progress.total,
		});
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
