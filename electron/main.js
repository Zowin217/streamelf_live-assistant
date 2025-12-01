const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

console.log('[Electron] Starting application...');
console.log('[Electron] isDev:', isDev);
console.log('[Electron] __dirname:', __dirname);

let mainWindow = null;
let prompterWindow = null;
let elfWindow = null;

function createMainWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Electron] Preload path:', preloadPath);
  console.log('[Electron] Preload exists:', fs.existsSync(preloadPath));
  
  if (!fs.existsSync(preloadPath)) {
    console.error('[Electron] ❌ CRITICAL: Preload file does not exist!');
    console.error('[Electron] Expected at:', preloadPath);
    console.error('[Electron] Current directory:', __dirname);
    console.error('[Electron] Files in electron directory:', fs.readdirSync(__dirname));
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Allow loading local resources in dev
      enableRemoteModule: false
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] Main window ready to show');
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close all floating windows when main window closes
    if (prompterWindow) prompterWindow.close();
    if (elfWindow) elfWindow.close();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Electron] Main window failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Electron] Main window DOM ready');
    // Check if electronAPI is available
    mainWindow.webContents.executeJavaScript(`
      console.log('[Electron] Checking electronAPI in renderer...');
      console.log('[Electron] window.electronAPI:', typeof window.electronAPI !== 'undefined' ? '✅ Available' : '❌ Not available');
      if (window.electronAPI) {
        console.log('[Electron] electronAPI methods:', Object.keys(window.electronAPI));
      } else {
        console.error('[Electron] ❌ electronAPI is undefined!');
        console.error('[Electron] window keys:', Object.keys(window));
        console.error('[Electron] Trying to access window.electronAPI directly...');
        try {
          console.error('[Electron] window.electronAPI value:', window.electronAPI);
        } catch(e) {
          console.error('[Electron] Cannot access window.electronAPI:', e);
        }
      }
    `).catch(err => console.error('[Electron] Error checking electronAPI:', err));
  });

  // Also check preload script loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Main window finished loading');
    mainWindow.webContents.executeJavaScript(`
      console.log('[Electron] After page load - electronAPI:', typeof window.electronAPI !== 'undefined' ? '✅ Available' : '❌ Not available');
    `).catch(err => console.error('[Electron] Error:', err));
  });
}

function createPrompterWindow() {
  if (prompterWindow && !prompterWindow.isDestroyed()) {
    prompterWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  console.log('[Electron] Creating prompter window at:', Math.floor((width - 600) / 2), 50);
  
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Electron] Prompter window preload path:', preloadPath);
  
  prompterWindow = new BrowserWindow({
    width: 600,
    height: 400,
    x: Math.floor((width - 600) / 2),
    y: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false
    }
  });

  const url = isDev ? 'http://localhost:3000/#prompter' : `file://${path.join(__dirname, '../dist/index.html')}#prompter`;
  console.log('[Electron] Loading prompter window URL:', url);
  prompterWindow.loadURL(url);

  prompterWindow.on('closed', () => {
    console.log('[Electron] Prompter window closed');
    prompterWindow = null;
  });

  prompterWindow.on('ready-to-show', () => {
    console.log('[Electron] Prompter window ready to show');
    prompterWindow.show();
  });

  prompterWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Electron] Prompter window failed to load:', errorCode, errorDescription);
  });

  // Make window draggable
  prompterWindow.setIgnoreMouseEvents(false, { forward: true });
}

function createElfWindow() {
  if (elfWindow && !elfWindow.isDestroyed()) {
    elfWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  console.log('[Electron] Creating elf window at:', width - 320, height - 420);
  
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Electron] Elf window preload path:', preloadPath);
  
  elfWindow = new BrowserWindow({
    width: 300,
    height: 400,
    x: width - 320,
    y: height - 420,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false
    }
  });

  const url = isDev ? 'http://localhost:3000/#elf' : `file://${path.join(__dirname, '../dist/index.html')}#elf`;
  console.log('[Electron] Loading elf window URL:', url);
  elfWindow.loadURL(url);

  elfWindow.on('closed', () => {
    console.log('[Electron] Elf window closed');
    elfWindow = null;
  });

  elfWindow.on('ready-to-show', () => {
    console.log('[Electron] Elf window ready to show');
    elfWindow.show();
  });

  elfWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Electron] Elf window failed to load:', errorCode, errorDescription);
  });

  // Make window draggable
  elfWindow.setIgnoreMouseEvents(false, { forward: true });
}

// Log immediately when script loads
console.log('========================================');
console.log('[Electron] main.js script loaded');
console.log('[Electron] Node version:', process.versions.node);
console.log('[Electron] Electron version:', process.versions.electron);
console.log('[Electron] Platform:', process.platform);
console.log('[Electron] isDev:', isDev);
console.log('========================================');

app.whenReady().then(() => {
  console.log('[Electron] ========== App ready, creating main window... ==========');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch(err => {
  console.error('[Electron] Error in app.whenReady():', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for creating floating windows
ipcMain.on('create-prompter-window', () => {
  console.log('[Electron] Creating prompter window...');
  try {
    createPrompterWindow();
    console.log('[Electron] Prompter window created successfully');
  } catch (error) {
    console.error('[Electron] Error creating prompter window:', error);
  }
});

ipcMain.on('create-elf-window', () => {
  console.log('[Electron] Creating elf window...');
  try {
    createElfWindow();
    console.log('[Electron] Elf window created successfully');
  } catch (error) {
    console.error('[Electron] Error creating elf window:', error);
  }
});

ipcMain.on('close-prompter-window', () => {
  if (prompterWindow) {
    prompterWindow.close();
  }
});

ipcMain.on('close-elf-window', () => {
  if (elfWindow) {
    elfWindow.close();
  }
});

