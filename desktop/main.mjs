import { app, BrowserWindow, dialog, session, shell } from 'electron';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
/** A fixed port keeps the page's origin, and so its localStorage and
 * IndexedDB, the same on every launch. Only a busy port falls back. */
const PREFERRED_PORT = 47173;
const SPLASH =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    '<body style="margin:0;background:#0a0a0f;color:#8a8fa3;font:15px system-ui;display:grid;place-items:center;height:100vh">Starting God\u2019s Eye View\u2026</body>',
  );

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

/** vite-plugin-cesium serves Cesium from the cwd-relative path
 * node_modules/cesium/Build, and the cwd is the data directory (the providers
 * cache under it), so the data directory carries a link to the app's modules. */
function linkModules(dataDir) {
  const link = path.join(dataDir, 'node_modules');
  try {
    fs.unlinkSync(link);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  fs.symlinkSync(path.join(appRoot, 'node_modules'), link, 'junction');
}

async function startServer() {
  const dataDir = app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });
  linkModules(dataDir);
  process.env.GEV_DATA_DIR = dataDir;
  process.chdir(dataDir);
  const port = await pickPort();
  const { createServer } = await import('vite');
  server = await createServer({
    root: appRoot,
    cacheDir: path.join(dataDir, 'vite-cache'),
    configLoader: 'native',
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0a0a0f',
    title: "God's Eye View",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocal(url)) return { action: 'allow' };
    openExternally(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isLocal(url) || url.startsWith('data:')) return;
    event.preventDefault();
    openExternally(url);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(SPLASH);
}

async function start() {
  createWindow();
  try {
    const origin = await startServer();
    installSessionPolicy();
    await mainWindow?.loadURL(origin);
  } catch (error) {
    dialog.showErrorBox(
      "God's Eye View could not start",
      error?.stack || String(error),
    );
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
