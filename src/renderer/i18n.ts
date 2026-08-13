import { createInstance, type i18n as I18nInstance, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { categoryLabelKey, defaultNS, hostLabelKey, namespaces, resources, scopeLabelKey, sourceLabelKey } from '../shared/i18n/resources';
import type { HostPlatform, SkillScope, SkillSourceType } from '../shared/types';

export const i18n: I18nInstance = createInstance();

export async function initializeRendererI18n(locale: string): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources,
        lng: normalizeLocale(locale),
        fallbackLng: 'zh-CN',
        supportedLngs: ['zh-CN', 'en-US'],
        ns: [...namespaces],
        defaultNS,
        interpolation: { escapeValue: false },
        returnNull: false
      });
  } else {
    await i18n.changeLanguage(normalizeLocale(locale));
  }
  applyDocumentLocale(normalizeLocale(locale));
}

export function applyDocumentLocale(locale: string): void {
  const resolved = normalizeLocale(locale);
  document.documentElement.lang = resolved;
  document.documentElement.dir = i18n.isInitialized ? i18n.dir(resolved) : 'ltr';
  document.title = i18n.isInitialized ? i18n.t('common:app.title') : 'Skills Manager Pro';
}

export function normalizeLocale(locale: string | null | undefined): 'zh-CN' | 'en-US' {
  return locale?.toLocaleLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

export function activeLocale(): 'zh-CN' | 'en-US' {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
}

export function translatedCategory(t: TFunction, category: string): string {
  const key = categoryLabelKey(category);
  return key ? t(key) : category;
}

export function translatedHost(t: TFunction, host: HostPlatform): string { return t(hostLabelKey(host)); }
export function translatedSource(t: TFunction, source: SkillSourceType): string { return t(sourceLabelKey(source)); }
export function translatedScope(t: TFunction, scope: SkillScope): string { return t(scopeLabelKey(scope)); }

export function localizedScanPhase(
  t: TFunction,
  progress: { phase: string; phaseCode?: string; phaseParams?: Record<string, string | number> }
): string {
  if (!progress.phaseCode) return progress.phase;
  const params = { ...(progress.phaseParams ?? {}) };
  if (params.rootLabelCode) {
    params.rootLabel = t(`workbench:roots.label.${params.rootLabelCode}`, { defaultValue: String(params.rootLabel ?? '') });
  }
  return t(`messages:${progress.phaseCode}`, { ...params, defaultValue: progress.phase });
}

export function localizedDiagnostic(
  t: TFunction,
  diagnostic: { code: string; title: string; message: string; params?: Record<string, string | number> }
): { title: string; message: string } {
  const params = { ...(diagnostic.params ?? {}) };
  if (diagnostic.code === 'main-file-large') {
    const sizeBytes = Number(params.sizeBytes);
    if (Number.isFinite(sizeBytes) && sizeBytes > 0) {
      params.formattedSize = formatCompactBytes(sizeBytes);
    } else if (!params.formattedSize && params.size) {
      params.formattedSize = params.size;
    }
  }
  return {
    title: t(`messages:diagnostic.${diagnostic.code}.title`, { ...params, defaultValue: diagnostic.title }),
    message: t(`messages:diagnostic.${diagnostic.code}.message`, { ...params, defaultValue: diagnostic.message })
  };
}

function formatCompactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${new Intl.NumberFormat(activeLocale()).format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function localizedAction(
  t: TFunction,
  log: { action: string; summary: string; descriptor?: { code: string; params?: Record<string, string | number> } }
): string {
  if (!log.descriptor) return log.summary;
  const params = { ...(log.descriptor.params ?? {}) };
  const requiredParams: Record<string, string[]> = {
    edit_file: ['path'], rename_display: ['before', 'after'], rename_internal: ['before', 'after'],
    trash: ['name'], restore: ['name'], restore_snapshot: ['path'], organize: ['category'], ai_analyze: ['provider']
  };
  if (requiredParams[log.descriptor.code]?.some((name) => params[name] === undefined || params[name] === '')) {
    return t(`messages:action.${log.descriptor.code}`, { defaultValue: log.summary });
  }
  if (log.descriptor.code === 'organize' && params.category) {
    params.category = translatedCategory(t, String(params.category));
  }
  const key = log.descriptor.code.startsWith('history.')
    ? `messages:${log.descriptor.code}`
    : `messages:action.summary.${log.descriptor.code}`;
  return t(key, { ...params, defaultValue: log.summary });
}
