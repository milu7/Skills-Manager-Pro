import { app, protocol } from 'electron';

// Squirrel launches the executable once for install, update and uninstall
// maintenance. Handle that invocation before loading SQLite, scanners or UI.
// The helper also creates/removes the correct Windows shortcuts.
const isSquirrelMaintenance = process.platform === 'win32'
  && Boolean(require('electron-squirrel-startup'));

if (isSquirrelMaintenance) {
  app.quit();
} else {
  // #9: note images are served over skill-note-image://<id> instead of base64
  // data URLs. Registering as standard + secure makes the URL parse with a
  // host component (the image id); must happen before app ready.
  protocol.registerSchemesAsPrivileged([
    { scheme: 'skill-note-image', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ]);
  require('./application');
}
