// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Electron main process
import { app, BrowserWindow, screen, ipcMain, shell, session } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

function getCurrentWindowState() {
  return {
    isMaximized: mainWindow?.isMaximized() ?? false,
    isFullScreen: mainWindow?.isFullScreen() ?? false,
  };
}

function notifyWindowStateChanged() {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send('window-state-changed', getCurrentWindowState());
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const trustedDevOrigin = (() => {
  if (!devServerUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(devServerUrl);
    const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    return isLocalHost ? parsedUrl.origin : null;
  } catch {
    return null;
  }
})();

function isTrustedAppUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'file:') {
      return true;
    }

    return trustedDevOrigin !== null && parsedUrl.origin === trustedDevOrigin;
  } catch {
    return url.startsWith('file://');
  }
}

function isTrustedOrigin(origin: string): boolean {
  if (origin === 'file://') {
    return true;
  }

  if (!trustedDevOrigin) {
    return false;
  }

  return origin === trustedDevOrigin;
}

function isSafeExternalHttpUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function getContentSecurityPolicy(): string {
  const commonDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ];

  if (trustedDevOrigin) {
    return [
      ...commonDirectives,
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${trustedDevOrigin} ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* stun: turn:`,
    ].join('; ');
  }

  return [
    ...commonDirectives,
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' stun: turn:",
  ].join('; ');
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const width = Math.max(1280, Math.floor(screenWidth * 0.8));
  const height = Math.max(720, Math.floor(screenHeight * 0.8));

  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const iconPath = isDev 
    ? path.join(__dirname, '../public/logo.png') 
    : path.join(__dirname, '../dist/logo.png');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    title: 'Haven',
    show: false,
    frame: false, // Disables the default OS frame
    backgroundColor: '#272727',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    notifyWindowStateChanged();
  });

  mainWindow.on('maximize', notifyWindowStateChanged);
  mainWindow.on('unmaximize', notifyWindowStateChanged);
  mainWindow.on('enter-full-screen', notifyWindowStateChanged);
  mainWindow.on('leave-full-screen', notifyWindowStateChanged);

  // Prevent links from navigating inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalHttpUrl(url)) {
      // Trigger a warning in the frontend UI instead of opening immediately
      mainWindow?.webContents.send('show-external-link-warning', url);
    }
    return { action: 'deny' };
  });

  // Prevent drag-and-drop navigation (e.g., dropping an HTML file into the chat)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
      // Trigger a warning in the frontend UI instead of opening immediately
      if (isSafeExternalHttpUrl(url)) {
        mainWindow?.webContents.send('show-external-link-warning', url);
      }
    }
  });
}

app.whenReady().then(() => {
  const contentSecurityPolicy = getContentSecurityPolicy();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ?? {};

    if (details.resourceType === 'mainFrame' || isTrustedAppUrl(details.url)) {
      responseHeaders['Content-Security-Policy'] = [contentSecurityPolicy];
    }

    callback({ responseHeaders });
  });

  // Handle WebRTC Permissions for Voice/Video calls
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];

    if (!allowedPermissions.includes(permission)) {
      return false;
    }

    if (!requestingOrigin) {
      return false;
    }

    return isTrustedOrigin(requestingOrigin);
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];
    const requestUrl = webContents.getURL();
    
    if (allowedPermissions.includes(permission) && isTrustedAppUrl(requestUrl)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();

  ipcMain.handle('get-window-state', () => {
    return getCurrentWindowState();
  });

  // Listen for user confirming to open an external link from the UI warning
  ipcMain.on('confirm-open-url', (_event, url) => {
    if (typeof url !== 'string') {
      return;
    }

    if (isSafeExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
  });

  // IPC listeners for the custom title bar
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
