import { app, BrowserWindow, Menu, protocol, session, shell } from 'electron';
import path from 'node:path';
import { AiService } from './main/ai-service';
import { closeDatabase, openDatabase } from './main/db/database';
import { registerIpc } from './main/ipc';
import { OperationsService } from './main/operations-service';
import { NoteService } from './main/note-service';
import { LocalizationService } from './main/localization-service';
import { ProviderService } from './main/provider-service';
import { RootsService } from './main/roots-service';
import { ScannerService } from './main/scanner-service';
import { SettingsService } from './main/settings-service';
import { SkillRepository } from './main/skill-repository';
import { WatchService } from './main/watch-service';
import packageJson from '../package.json';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let disposeIpc: (() => void) | null = null;
let watcher: WatchService | null = null;
let initialScanTimer: NodeJS.Timeout | null = null;

// Keep Chromium storage, SQLite, logs and caches under the same overridable
// userData root. This makes tests and portable diagnostics genuinely isolated.
if (process.env.SKILL_WORKBENCH_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.SKILL_WORKBENCH_USER_DATA));
} else {
  // Keep the default data directory aligned with the English product name.
  app.setPath('userData', path.join(app.getPath('appData'), 'Skills Manager Pro'));
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
  const settings = new SettingsService(database, () => app.getPreferredSystemLanguages());
  const localization = new LocalizationService();
  await localization.initialize(settings.resolvedLocale);
  const translate = (key: string, params?: Record<string, string | number>) => localization.t(key, params);
  const roots = new RootsService(database, userDataPath, translate);
  await roots.initializeDefaults();
  await roots.addTestRootIfConfigured();
  const repository = new SkillRepository(database, () => settings.resolvedLocale, translate);
  const scanner = new ScannerService(database, repository, translate);
  const providers = new ProviderService(database, translate);
  const trashPath = path.join(userDataPath, 'trash');
  const operations = new OperationsService(database, repository, scanner, trashPath, translate);
  const notes = new NoteService(database, translate);
  const ai = new AiService(database, repository, operations, providers, () => settings.resolvedLocale, translate);
  watcher = new WatchService(scanner);
  // #9: serve note images by id over the custom scheme before the window loads.
  protocol.handle('skill-note-image', (request) => notes.handleImageRequest(request));

  mainWindow = createWindow(localization);
  disposeIpc = registerIpc({
    database, roots, repository, scanner, operations, notes, providers, settings, localization, ai, watcher,
    userDataPath, version: packageJson.version, mainWindow
  });
  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  // File watching and a full refresh are background work. The cached catalog
  // should be interactive before either task starts touching large skill trees.
  void watcher.reset(roots.list()).catch((error) => console.warn('Skill watcher failed to start:', error));
  initialScanTimer = setTimeout(() => void scanner.scanAll(), 250);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // #17: clear the pending initial scan so a fast quit does not start a
  // full rescan after the database is closed.
  if (initialScanTimer) {
    clearTimeout(initialScanTimer);
    initialScanTimer = null;
  }
  disposeIpc?.();
  disposeIpc = null;
  void watcher?.close();
  closeDatabase();
});

function createWindow(localization: LocalizationService): BrowserWindow {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#F2F5F7',
    title: localization.t('common:app.title'),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });
  window.on('page-title-updated', (event) => {
    event.preventDefault();
    window.setTitle(localization.t('common:app.title'));
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
