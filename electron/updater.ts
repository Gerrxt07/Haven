import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateChannelCandidate = "release" | "nightly";

const updateSettingsPath = path.join(
	app.getPath("userData"),
	"update-settings.json",
);
const startupUpdateTimeoutMs = 30_000;

type StartupUpdateFlowOptions = {
	iconPath: string;
	onReadyToLaunch: () => void;
};

function isStartupUpdateEnabled(): boolean {
	return app.isPackaged && !process.env.VITE_DEV_SERVER_URL;
}

function createUpdateWindow(iconPath: string): BrowserWindow {
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
					body {
						margin: 0;
						font-family: Inter, Segoe UI, system-ui, -apple-system, sans-serif;
						display: grid;
						place-items: center;
						min-height: 100vh;
						background: #272727;
					}
					.spinner {
						width: 42px;
						height: 42px;
						border: 3px solid rgba(255, 255, 255, 0.18);
						border-top-color: #ffffff;
						border-radius: 50%;
						animation: spin 1s linear infinite;
					}
					@keyframes spin {
						to {
							transform: rotate(360deg);
						}
					}
				</style>
			</head>
			<body>
				<div class="spinner" aria-hidden="true"></div>
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

	return "release";
}

export async function setUpdateChannelCandidate(
	candidate: UpdateChannelCandidate,
): Promise<boolean> {
	if (candidate !== "release" && candidate !== "nightly") {
		return false;
	}

	await fs.writeFile(
		updateSettingsPath,
		JSON.stringify({ candidate }, null, 2),
		"utf-8",
	);

	return true;
}

export async function runStartupUpdateFlow({
	iconPath,
	onReadyToLaunch,
}: StartupUpdateFlowOptions): Promise<void> {
	if (!isStartupUpdateEnabled()) {
		onReadyToLaunch();
		return;
	}

	const updateWindow = createUpdateWindow(iconPath);
	const candidate = await getUpdateChannelCandidate();

	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.allowPrerelease = candidate === "nightly";
	autoUpdater.allowDowngrade = candidate === "nightly";

	let launched = false;
	let startupTimeout: NodeJS.Timeout | null = null;
	const launchMainApp = () => {
		if (launched) {
			return;
		}

		launched = true;
		if (startupTimeout) {
			clearTimeout(startupTimeout);
			startupTimeout = null;
		}

		autoUpdater.removeAllListeners();
		if (!updateWindow.isDestroyed()) {
			updateWindow.destroy();
		}
		onReadyToLaunch();
	};

	startupTimeout = setTimeout(() => {
		launchMainApp();
	}, startupUpdateTimeoutMs);

	autoUpdater.on("update-not-available", () => {
		launchMainApp();
	});

	autoUpdater.on("error", () => {
		launchMainApp();
	});

	autoUpdater.on("update-downloaded", () => {
		if (startupTimeout) {
			clearTimeout(startupTimeout);
			startupTimeout = null;
		}
		setTimeout(() => {
			autoUpdater.quitAndInstall(false, true);
		}, 900);
	});

	try {
		await autoUpdater.checkForUpdates();
	} catch {
		clearTimeout(startupTimeout);
		launchMainApp();
	}
}
