// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Electron main process
import { app, BrowserWindow, screen, ipcMain, safeStorage, shell, session, Menu } from 'electron';
import path from 'node:path';

// Set up a path to store your encrypted auth data
const authFilePath = path.join(app.getPath('userData'), 'auth.enc');

let mainWindow: BrowserWindow | null = null;

function isTrustedSender(sender: Electron.WebContents): boolean {
  if (!mainWindow) return false;
  return sender === mainWindow.webContents;
}

// Listeners to save and load tokens securely
ipcMain.handle('secure-store-token', async (event, token: string) => {
  if (!isTrustedSender(event.sender)) return false;
  
  if (safeStorage.isEncryptionAvailable()) {
    const encryptedToken = safeStorage.encryptString(token);
    await Bun.write(authFilePath, encryptedToken);
    return true;
  }
  return false; // Handle fallback if encryption isn't available
});

ipcMain.handle('secure-get-token', async (event) => {
  if (!isTrustedSender(event.sender)) return null;

  try {
    if ((await Bun.file(authFilePath).exists()) && safeStorage.isEncryptionAvailable()) {
      const encryptedToken = Buffer.from(await Bun.file(authFilePath).arrayBuffer());
      return safeStorage.decryptString(encryptedToken);
    }
  } catch (error) {
    console.error('Failed to decrypt token:', error);
  }
  return null;
});

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
    "style-src 'self'",
    "connect-src 'self' stun: turn:",
  ].join('; ');
}

// Strip dangerous command line arguments commonly used by stealers
const dangerousArgs = [
  '--remote-debugging-port',
  '--remote-debugging-pipe',
  '--inspect',
  '--inspect-brk',
  '--enable-blink-features',
  '--js-flags'
];

for (const arg of process.argv) {
  if (dangerousArgs.some(danger => arg.startsWith(danger))) {
    console.error('Dangerous command line argument detected. Exiting.');
    app.quit();
    process.exit(1);
  }
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
    minWidth: 1280,
    minHeight: 720,
    title: 'Haven',
    show: false,
    frame: false,
    backgroundColor: '#272727',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableWebSQL: false,
      disableBlinkFeatures: 'Auxclick',
      v8CacheOptions: 'bypassHeatCheck',
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
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

  let resizeTimeout: NodeJS.Timeout | null = null;
  function notifyWindowStateChangedThrottled() {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null; // Explicitly nullify for GC
    }
    resizeTimeout = setTimeout(() => {
      notifyWindowStateChanged();
      resizeTimeout = null;
    }, 100); 
  }

  mainWindow.on('maximize', notifyWindowStateChangedThrottled);
  mainWindow.on('unmaximize', notifyWindowStateChangedThrottled);
  mainWindow.on('enter-full-screen', notifyWindowStateChangedThrottled);
  mainWindow.on('leave-full-screen', notifyWindowStateChangedThrottled);
  mainWindow.on('resize', notifyWindowStateChangedThrottled);

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

Menu.setApplicationMenu(null);

// Prevent WebRTC from leaking local IP addresses
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only');

app.whenReady().then(() => {
  const contentSecurityPolicy = getContentSecurityPolicy();

  app.on('browser-window-created', (_, window) => {
    // Prevent DevTools from opening in Production
    if (!process.env.VITE_DEV_SERVER_URL) {
      window.webContents.on('devtools-opened', () => {
        window.webContents.closeDevTools();
      });
    }
  });

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

  ipcMain.handle('get-window-state', (event) => {
    if (!isTrustedSender(event.sender)) return null;
    return getCurrentWindowState();
  });

  // Listen for user confirming to open an external link from the UI warning
  ipcMain.on('confirm-open-url', (event, url) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof url !== 'string') {
      return;
    }

    if (isSafeExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
  });

  // IPC listeners for the custom title bar
  ipcMain.on('window-minimize', (event) => {
    if (!isTrustedSender(event.sender)) return;
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    if (!isTrustedSender(event.sender)) return;
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', (event) => {
    if (!isTrustedSender(event.sender)) return;
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
