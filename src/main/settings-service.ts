import type { LocalePreference, LocaleState, SupportedLocale } from '../shared/types';
import type { DatabaseContext } from './db/database';
import { resolvePreferredLocale } from './localization-service';

export const LOCALE_PREFERENCE_SETTING_KEY = 'locale.preference';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['zh-CN', 'en-US'];

type PreferredLanguagesProvider = () => readonly string[];

export class SettingsService {
  private resolvedSystemLocale: SupportedLocale;

  constructor(
    private readonly database: DatabaseContext,
    private readonly preferredLanguages: PreferredLanguagesProvider
  ) {
    this.resolvedSystemLocale = resolvePreferredLocale(preferredLanguages());
  }

  get resolvedLocale(): SupportedLocale {
    return this.getLocaleState().resolvedLocale;
  }

  getLocaleState(): LocaleState {
    const preference = this.readLocalePreference();
    return {
      preference,
      resolvedLocale: preference === 'system'
        ? this.resolvedSystemLocale
        : preference,
      supportedLocales: [...SUPPORTED_LOCALES]
    };
  }

  setLocalePreference(preference: LocalePreference): LocaleState {
    if (preference === 'system') {
      this.resolvedSystemLocale = resolvePreferredLocale(this.preferredLanguages());
    }
    this.writeLocalePreference(preference);
    return this.getLocaleState();
  }

  private readLocalePreference(): LocalePreference {
    const row = this.database.sqlite
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(LOCALE_PREFERENCE_SETTING_KEY) as { value: string } | undefined;
    if (isLocalePreference(row?.value)) return row.value;

    // A pre-i18n database must remain Chinese after upgrading. A newly created
    // database follows the operating system until the user chooses explicitly.
    const fallback: LocalePreference = row ? 'zh-CN' : this.database.isNewDatabase ? 'system' : 'zh-CN';
    this.writeLocalePreference(fallback);
    return fallback;
  }

  private writeLocalePreference(preference: LocalePreference): void {
    this.database.sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(LOCALE_PREFERENCE_SETTING_KEY, preference, new Date().toISOString());
  }
}

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'zh-CN' || value === 'en-US';
}
