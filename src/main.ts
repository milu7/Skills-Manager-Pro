import { app } from 'electron';

// Squirrel launches the executable once for install, update and uninstall
// maintenance. Handle that invocation before loading SQLite, scanners or UI.
// The helper also creates/removes the correct Windows shortcuts.
const isSquirrelMaintenance = process.platform === 'win32'
  && Boolean(require('electron-squirrel-startup'));

if (isSquirrelMaintenance) {
  app.quit();
} else {
  require('./application');
}
