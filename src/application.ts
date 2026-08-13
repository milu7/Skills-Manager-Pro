import { app, BrowserWindow, Menu, session, shell } from 'electron';
import path from 'node:path';
import { AiService } from './main/ai-service';
import { closeDatabase, openDatabase } from './main/db/database';
import { registerIpc } from './main/ipc';
import { OperationsService } from './main/operations-service';
import { NoteService } from './main/note-service';
import { ProviderService } from './main/provider-service';
import { RootsService } from './main/roots-service';
import { ScannerService } from './main/scanner-service';
import { SkillRepository } from './main/skill-repository';
import { WatchService } from './main/watch-service';
import packageJson from '../package.json';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let disposeIpc: (() => void) | null = null;
let watcher: WatchService | null = null;

// Keep Chromium storage, SQLite, logs and caches under the same overridable
// userData root. This makes tests and portable diagnostics genuinely isolated.
if (process.env.SKILL_WORKBENCH_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.SKILL_WORKBENCH_USER_DATA));
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.skill_workbench.SkillWorkbench');
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const userDataPath = app.getPath('userData');
  const database = openDatabase(userDataPath);
  const roots = new RootsService(database, userDataPath);
  await roots.initializeDefaults();
  await roots.addTestRootIfConfigured();
  const repository = new SkillRepository(database);
  const scanner = new ScannerService(database, repository);
  const providers = new ProviderService(database);
  const trashPath = path.join(userDataPath, 'trash');
  const operations = new OperationsService(database, repository, scanner, trashPath);
  const notes = new NoteService(database);
  const ai = new AiService(database, repository, operations, providers);
  watcher = new WatchService(scanner);

  mainWindow = createWindow();
  disposeIpc = registerIpc({
    database, roots, repository, scanner, operations, notes, providers, ai, watcher,
    userDataPath, version: packageJson.version, mainWindow
  });
  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  // File watching and a full refresh are background work. The cached catalog
  // should be interactive before either task starts touching large skill trees.
  void watcher.reset(roots.list()).catch((error) => console.warn('Skill watcher failed to start:', error));
  setTimeout(() => void scanner.scanAll(), 250);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  disposeIpc?.();
  disposeIpc = null;
  void watcher?.close();
  closeDatabase();
});

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#F2F5F7',
    title: 'Skills Manager Pro',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  return window;
}
