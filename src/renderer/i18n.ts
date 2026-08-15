import { createInstance, type i18n as I18nInstance, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { categoryLabelKey, defaultNS, hostLabelKey, namespaces, resources, scopeLabelKey, sourceLabelKey } from '../shared/i18n/resources';
import { AI_TOOL_LOCATIONS, FIRST_CLASS_HOSTS } from '../shared/ai-tool-catalog';
import type { HostPlatform, SkillScope, SkillSourceType } from '../shared/types';

// Brand icons for every discovered AI tool. File names follow the catalogue
// key, except: OMP Agent ships as oh_my_pi.svg, TRAE CN roots share one icon,
// and the first-class `claude` host reuses the Claude Code mark.
import adalIcon from './assets/platforms/adal.png';
import ampIcon from './assets/platforms/amp.svg';
import antigravityIcon from './assets/platforms/antigravity.png';
import augmentIcon from './assets/platforms/augment.svg';
import bobIcon from './assets/platforms/bob.png';
import claudeCodeIcon from './assets/platforms/claude_code.svg';
import clineIcon from './assets/platforms/cline.png';
import codebuddyIcon from './assets/platforms/codebuddy.svg';
import codexIcon from './assets/platforms/codex.svg';
import commandCodeIcon from './assets/platforms/command_code.svg';
import continueIcon from './assets/platforms/continue.png';
import cortexIcon from './assets/platforms/cortex.png';
import crushIcon from './assets/platforms/crush.png';
import cursorIcon from './assets/platforms/cursor.png';
import deepagentsIcon from './assets/platforms/deepagents.png';
import droidIcon from './assets/platforms/droid.svg';
import firebenderIcon from './assets/platforms/firebender.svg';
import geminiCliIcon from './assets/platforms/gemini_cli.svg';
import githubCopilotIcon from './assets/platforms/github_copilot.png';
import gooseIcon from './assets/platforms/goose.png';
import grokIcon from './assets/platforms/grok.svg';
import hermesIcon from './assets/platforms/hermes.png';
import iflowIcon from './assets/platforms/iflow.png';
import junieIcon from './assets/platforms/junie.png';
import kiloCodeIcon from './assets/platforms/kilo_code.svg';
import kimiIcon from './assets/platforms/kimi.svg';
import kiroIcon from './assets/platforms/kiro.svg';
import kodeIcon from './assets/platforms/kode.png';
import mcpjamIcon from './assets/platforms/mcpjam.png';
import mistralVibeIcon from './assets/platforms/mistral_vibe.svg';
import muxIcon from './assets/platforms/mux.png';
import neovateIcon from './assets/platforms/neovate.png';
import ohMyPiIcon from './assets/platforms/oh_my_pi.svg';
import openclawIcon from './assets/platforms/openclaw.svg';
import opencodeIcon from './assets/platforms/opencode.png';
import openhandsIcon from './assets/platforms/openhands.png';
import piIcon from './assets/platforms/pi.svg';
import pochiIcon from './assets/platforms/pochi.png';
import qoderIcon from './assets/platforms/qoder.svg';
import qwenCodeIcon from './assets/platforms/qwen_code.png';
import replitIcon from './assets/platforms/replit.png';
import rooCodeIcon from './assets/platforms/roo_code.svg';
import traeIcon from './assets/platforms/trae.svg';
import traeCnIcon from './assets/platforms/trae_cn.svg';
import warpIcon from './assets/platforms/warp.svg';
import windsurfIcon from './assets/platforms/windsurf.svg';
import workbuddyIcon from './assets/platforms/workbuddy.png';
import zencoderIcon from './assets/platforms/zencoder.png';

const hostDisplayNames = new Map(AI_TOOL_LOCATIONS.map((tool) => [tool.key, tool.displayName]));
const toolByKey = new Map(AI_TOOL_LOCATIONS.map((tool) => [tool.key, tool]));

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

export function translatedHost(t: TFunction, host: HostPlatform): string {
  const key = hostLabelKey(host);
  const label = t(key);
  // i18next returns the bare key ('host.trae') — not the namespaced key — when
  // a translation is missing, so compare against both. On a miss, fall back to
  // the tool's catalogue display name (TRAE IDE, Cursor, Windsurf, …) instead
  // of leaking the key into the UI.
  if (label !== key && label !== key.slice(key.indexOf(':') + 1)) return label;
  return hostDisplayNames.get(host) ?? host;
}

/** True when the host is a discovered AI tool (not a first-class host or custom). */
export function isToolHost(host: HostPlatform): boolean {
  return host !== 'custom'
    && !(FIRST_CLASS_HOSTS as readonly string[]).includes(host)
    && toolByKey.has(host);
}

/** root-tool-* color class for a tool host (empty when no palette rule matches). */
export function toolColorClass(host: HostPlatform): string {
  const tool = toolByKey.get(host);
  return tool ? `root-tool-${tool.key.replace(/_/g, '-')}` : '';
}

/** 1–2 letter mark derived from the tool display name, e.g. "TR" for TRAE IDE. */
export function toolMarkText(host: HostPlatform): string {
  const tool = toolByKey.get(host);
  if (!tool) return '';
  return tool.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Brand icon URL for a platform host, or undefined when the catalogue has no
 * asset for it (custom roots, the OpenClaw family, …). Callers fall back to a
 * colored initials mark when no icon exists.
 */
const TOOL_ICON_BY_KEY: Record<string, string | undefined> = {
  adal: adalIcon, amp: ampIcon, antigravity: antigravityIcon, augment: augmentIcon,
  bob: bobIcon, claude: claudeCodeIcon, claude_code: claudeCodeIcon, cline: clineIcon,
  codebuddy: codebuddyIcon, codex: codexIcon, command_code: commandCodeIcon,
  continue: continueIcon, cortex: cortexIcon, crush: crushIcon, cursor: cursorIcon,
  deepagents: deepagentsIcon, droid: droidIcon, firebender: firebenderIcon,
  gemini_cli: geminiCliIcon, github_copilot: githubCopilotIcon, goose: gooseIcon,
  grok: grokIcon, hermes: hermesIcon, iflow: iflowIcon, junie: junieIcon,
  kilo_code: kiloCodeIcon, kimi: kimiIcon, kiro: kiroIcon, kode: kodeIcon,
  mcpjam: mcpjamIcon, mistral_vibe: mistralVibeIcon, mux: muxIcon, neovate: neovateIcon,
  omp_agent: ohMyPiIcon, openclaw: openclawIcon, opencode: opencodeIcon,
  openhands: openhandsIcon, pi: piIcon, pochi: pochiIcon, qoder: qoderIcon,
  qwen_code: qwenCodeIcon, replit: replitIcon, roo_code: rooCodeIcon, trae: traeIcon,
  trae_cn_builtin: traeCnIcon, trae_cn_builtin_skills: traeCnIcon, trae_cn_plugins: traeCnIcon,
  warp: warpIcon, windsurf: windsurfIcon, workbuddy: workbuddyIcon, zencoder: zencoderIcon
};

export function toolIcon(host: HostPlatform): string | undefined {
  return TOOL_ICON_BY_KEY[host];
}
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
