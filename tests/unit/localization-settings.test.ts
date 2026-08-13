import { afterEach, describe, expect, it } from 'vitest';
import BetterSqlite3 from 'better-sqlite3/win32-x64';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, openDatabase } from '../../src/main/db/database';
import { migrations } from '../../src/main/db/migrations';
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  resolvePreferredLocale
} from '../../src/main/localization-service';
import { SettingsService } from '../../src/main/settings-service';

const temporaryPaths: string[] = [];

afterEach(async () => {
  closeDatabase();
  for (const target of temporaryPaths.splice(0)) {
    await fs.rm(target, { recursive: true, force: true });
  }
});

describe('localization', () => {
  it.each([
    ['zh-CN', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['zh_Hans_CN', 'zh-CN'],
    ['en-US', 'en-US'],
    ['en-GB', 'en-US'],
    ['EN_us', 'en-US'],
    ['fr-FR', null],
    ['', null]
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeSupportedLocale(input)).toBe(expected);
  });

  it('uses the first supported preferred language and otherwise falls back to Chinese', () => {
    expect(resolvePreferredLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('en-US');
    expect(resolvePreferredLocale(['fr-FR', 'de-DE'])).toBe(DEFAULT_LOCALE);
    expect(resolvePreferredLocale([])).toBe('zh-CN');
  });
});

describe('SettingsService locale persistence', () => {
  it('uses system preference for a new database and resolves the OS language', async () => {
    const userData = await createUserData();
    const database = openDatabase(userData);
    const settings = new SettingsService(database, () => ['fr-FR', 'en-GB']);

    expect(settings.getLocaleState()).toEqual({
      preference: 'system',
      resolvedLocale: 'en-US',
      supportedLocales: ['zh-CN', 'en-US']
    });
  });

  it('defaults an upgraded database to Chinese', async () => {
    const userData = await createUserData();
    const databasePath = path.join(userData, 'skill-workbench.sqlite3');
    const legacy = new BetterSqlite3(databasePath);
    legacy.exec(migrations[0].sql);
    legacy.pragma('user_version = 1');
    legacy.close();

    const database = openDatabase(userData);
    const settings = new SettingsService(database, () => ['en-US']);

    expect(settings.getLocaleState()).toMatchObject({ preference: 'zh-CN', resolvedLocale: 'zh-CN' });
  });

  it('repairs an invalid stored preference to Chinese', async () => {
    const userData = await createUserData();
    const database = openDatabase(userData);
    database.sqlite.prepare('UPDATE settings SET value = ? WHERE key = ?')
      .run('fr-FR', 'locale.preference');
    const settings = new SettingsService(database, () => ['en-US']);

    expect(settings.getLocaleState()).toMatchObject({ preference: 'zh-CN', resolvedLocale: 'zh-CN' });
    expect(readStoredPreference(database.sqlite)).toBe('zh-CN');
  });

  it('persists a manual preference and keeps it after reopening the database', async () => {
    const userData = await createUserData();
    let database = openDatabase(userData);
    let settings = new SettingsService(database, () => ['zh-CN']);

    expect(settings.setLocalePreference('en-US')).toMatchObject({
      preference: 'en-US',
      resolvedLocale: 'en-US'
    });
    closeDatabase();

    database = openDatabase(userData);
    settings = new SettingsService(database, () => ['zh-CN']);
    expect(settings.getLocaleState()).toMatchObject({ preference: 'en-US', resolvedLocale: 'en-US' });
  });

  it('keeps system resolution consistent for a session and refreshes it when system is selected again', async () => {
    const userData = await createUserData();
    const database = openDatabase(userData);
    let preferred = ['en-US'];
    const settings = new SettingsService(database, () => preferred);

    expect(settings.getLocaleState()).toMatchObject({ preference: 'system', resolvedLocale: 'en-US' });
    preferred = ['zh-CN'];
    expect(settings.getLocaleState()).toMatchObject({ preference: 'system', resolvedLocale: 'en-US' });
    expect(settings.setLocalePreference('system')).toMatchObject({ preference: 'system', resolvedLocale: 'zh-CN' });
  });
});

async function createUserData(): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-locale-'));
  temporaryPaths.push(base);
  const userData = path.join(base, 'user-data');
  await fs.mkdir(userData, { recursive: true });
  return userData;
}

function readStoredPreference(sqlite: BetterSqlite3.Database): string | undefined {
  return (sqlite.prepare('SELECT value FROM settings WHERE key = ?')
    .get('locale.preference') as { value: string } | undefined)?.value;
}
