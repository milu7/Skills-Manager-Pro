const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { WebpackPlugin } = require('@electron-forge/plugin-webpack');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { MakerZIP } = require('@electron-forge/maker-zip');
const fs = require('node:fs');
const path = require('node:path');
const mainConfig = require('./webpack.main.config');
const rendererConfig = require('./webpack.renderer.config');

const PACKAGED_LOCALES = new Set(['en-US.pak', 'zh-CN.pak', 'zh-TW.pak']);

function keepSupportedLocales(buildPath, _electronVersion, platform, _arch, callback) {
  if (platform !== 'win32') {
    callback();
    return;
  }
  try {
    const localesPath = path.join(buildPath, 'locales');
    for (const entry of fs.readdirSync(localesPath, { withFileTypes: true })) {
      if (entry.isFile() && !PACKAGED_LOCALES.has(entry.name)) {
        fs.rmSync(path.join(localesPath, entry.name));
      }
    }
    callback();
  } catch (error) {
    callback(error);
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'SkillsManagerPro',
    appBundleId: 'local.skill-workbench',
    afterExtract: [keepSupportedLocales]
  },
  // better-sqlite3 13 ships a Node-API binary per platform. Rebuilding it would
  // unnecessarily require the Visual Studio C++ workload on every contributor machine.
  rebuildConfig: { ignoreModules: ['better-sqlite3'] },
  makers: [new MakerZIP({}, ['win32'])],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts'
            }
          }
        ]
      }
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
