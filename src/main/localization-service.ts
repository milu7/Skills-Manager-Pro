import { createInstance, type i18n, type TOptions } from 'i18next';
import { defaultNS, namespaces, resources } from '../shared/i18n/resources';
import type { SupportedLocale } from '../shared/types';

export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';

export function normalizeSupportedLocale(value: string): SupportedLocale | null {
  const language = value.trim().replace(/_/g, '-').toLowerCase().split('-')[0];
  if (language === 'zh') return 'zh-CN';
  if (language === 'en') return 'en-US';
  return null;
}

export function resolvePreferredLocale(preferredLanguages: readonly string[]): SupportedLocale {
  for (const preferredLanguage of preferredLanguages) {
    const locale = normalizeSupportedLocale(preferredLanguage);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export class LocalizationService {
  private readonly instance: i18n = createInstance();
  private currentLocale: SupportedLocale = DEFAULT_LOCALE;

  get resolvedLocale(): SupportedLocale {
    return this.currentLocale;
  }

  async initialize(locale: SupportedLocale): Promise<void> {
    await this.instance.init({
      resources,
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: ['zh-CN', 'en-US'],
      nonExplicitSupportedLngs: false,
      ns: [...namespaces],
      defaultNS,
      interpolation: { escapeValue: false },
      initAsync: false
    });
    this.currentLocale = locale;
  }

  async changeLocale(locale: SupportedLocale): Promise<void> {
    if (!this.instance.isInitialized) await this.initialize(locale);
    else await this.instance.changeLanguage(locale);
    this.currentLocale = locale;
  }

  t(key: string, options?: TOptions): string {
    return this.instance.t(key, options);
  }
}
