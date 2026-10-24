import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  screen,
  session,
  shell,
} from 'electron';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prebuiltClientPlugin } from './prebuilt-client.mjs';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(desktopDir, '..');
/** A fixed port keeps the page's origin, and so its localStorage and
 * IndexedDB, the same on every launch. Only a busy port falls back. */
const PREFERRED_PORT = 47173;
const DEFAULT_SIZE = { width: 1440, height: 900 };
const MIN_SIZE = { width: 960, height: 600 };
const BACKGROUND = '#0a0a0f';
/** The View menu offers DevTools to unpackaged runs or with MGEV_DEVTOOLS=1. */
const devTools = !app.isPackaged || process.env.MGEV_DEVTOOLS === '1';

let server = null;
let mainWindow = null;
let localOrigin = '';
let closingServer = false;

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => {
      const { port: bound } = probe.address();
      probe.close(() => resolve(bound));
    });
  });
}

async function pickPort() {
  try {
    return await listenOn(PREFERRED_PORT);
  } catch {
    return listenOn(0);
  }
}

async function startServer() {
  const dataDir = app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.GEV_DATA_DIR = dataDir;
  // Providers keep their caches under the working directory.
  process.chdir(dataDir);
  const port = await pickPort();
  const { createServer } = await import('vite');
  server = await createServer({
    root: appRoot,
    cacheDir: path.join(dataDir, 'vite-cache'),
    configLoader: 'native',
    plugins: [prebuiltClientPlugin(path.join(appRoot, 'client'))],
    server: { host: '127.0.0.1', port, strictPort: true, open: false },
  });
  await server.listen();
  localOrigin = `http://127.0.0.1:${port}`;
  return localOrigin;
}

const isLocal = (url) => {
  try {
    return new URL(url).origin === localOrigin;
  } catch {
    return false;
  }
};

function openExternally(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

function installSessionPolicy() {
  const allowed = new Set(['media', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler(
    (_contents, permission, callback, details) =>
      callback(allowed.has(permission) && isLocal(details.requestingUrl)),
  );
  session.defaultSession.setPermissionCheckHandler(
    (_contents, permission, requestingOrigin) =>
      allowed.has(permission) && isLocal(requestingOrigin),
  );
}

function installMenu() {
  const isMac = process.platform === 'darwin';
  app.setAboutPanelOptions({
    applicationName: 'MGEV',
    applicationVersion: app.getVersion(),
    credits:
      "My God's Eye View, based on God's Eye View by Bilawal Sidhu (MIT License).",
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: isMac ? 'appMenu' : 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          ...(devTools ? [{ role: 'toggleDevTools' }] : []),
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
}

const windowStateFile = () =>
  path.join(app.getPath('userData'), 'window-state.json');

/** Last session's bounds, when they still overlap a connected display. */
function loadWindowState() {
  try {
    const { bounds, maximized } = JSON.parse(
      fs.readFileSync(windowStateFile(), 'utf8'),
    );
    const { x, y, width, height } = bounds;
    if (![x, y, width, height].every(Number.isFinite)) return {};
    const onScreen = screen
      .getAllDisplays()
      .some(
        ({ workArea: area }) =>
          x < area.x + area.width &&
          x + width > area.x &&
          y < area.y + area.height &&
          y + height > area.y,
      );
    if (!onScreen) return {};
    return {
      bounds: {
        x,
        y,
        width: Math.max(width, MIN_SIZE.width),
        height: Math.max(height, MIN_SIZE.height),
      },
      maximized: maximized === true,
    };
  } catch {
    return {};
  }
}

function saveWindowState(window) {
  try {
    fs.writeFileSync(
      windowStateFile(),
      JSON.stringify({
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized(),
      }),
    );
  } catch (error) {
    console.warn('[MGEV] Window state not saved:', error?.message || error);
  }
}

function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...state.bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    backgroundColor: BACKGROUND,
    title: 'MGEV',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  if (state.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  // The page's own <title> would rename the window.
  mainWindow.on('page-title-updated', (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocal(url)) return { action: 'allow' };
    openExternally(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isLocal(url)) return;
    event.preventDefault();
    openExternally(url);
  });
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadFile(path.join(desktopDir, 'splash.html'));
}

async function start() {
  installMenu();
  createWindow();
  try {
    const origin = await startServer();
    installSessionPolicy();
    await mainWindow?.loadURL(origin);
  } catch (error) {
    dialog.showErrorBox('MGEV could not start', error?.stack || String(error));
    app.exit(1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!server || closingServer) return;
    closingServer = true;
    event.preventDefault();
    server.close().finally(() => {
      server = null;
      app.quit();
    });
  });
  app.whenReady().then(start);
}
