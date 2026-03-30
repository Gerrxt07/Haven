// Electron main process
import { app, BrowserWindow, screen, ipcMain, shell, session } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

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
    frame: false, // Disables the default OS frame
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

  // Prevent links from navigating inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // Trigger a warning in the frontend UI instead of opening immediately
      mainWindow?.webContents.send('show-external-link-warning', url);
    }
    return { action: 'deny' };
  });

  // Prevent drag-and-drop navigation (e.g., dropping an HTML file into the chat)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(process.env.VITE_DEV_SERVER_URL || 'file://')) {
      event.preventDefault();
      // Trigger a warning in the frontend UI instead of opening immediately
      mainWindow?.webContents.send('show-external-link-warning', url);
    }
  });
}

app.whenReady().then(() => {
  // Handle WebRTC Permissions for Voice/Video calls
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];
    
    if (allowedPermissions.includes(permission)) {
      // You can add logic here to prompt the user or check against a safe domain
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();

  // Listen for user confirming to open an external link from the UI warning
  ipcMain.on('confirm-open-url', (_event, url) => {
    shell.openExternal(url);
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
