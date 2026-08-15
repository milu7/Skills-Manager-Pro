import { beforeEach, describe, expect, it, vi } from 'vitest';

// formatBytes formats with the active locale; pin it for deterministic output.
vi.mock('../../src/renderer/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/renderer/i18n')>()),
  activeLocale: () => 'zh-CN'
}));

import { formatBytes } from '../../src/renderer/components/common';
import { readableError } from '../../src/renderer/store';
import { isToolHost, toolColorClass, toolIcon, toolMarkText, translatedHost } from '../../src/renderer/i18n';
import { AI_TOOL_LOCATIONS, toolHostKey } from '../../src/shared/ai-tool-catalog';
import { createInstance } from 'i18next';
import { defaultNS, namespaces, resources } from '../../src/shared/i18n/resources';

describe('renderer logic', () => {
  it('formats byte sizes with locale-aware separators and adaptive precision', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1,023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(5.5 * 1024)).toBe('5.5 KB');
    expect(formatBytes(15 * 1024)).toBe('15 KB');
    expect(formatBytes(1.25 * 1024 * 1024)).toBe('1.3 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('strips IPC and Error prefixes from surfaced errors', () => {
    expect(readableError(new Error('Error invoking remote method \'skills.list\': boom'))).toBe('boom');
    expect(readableError(new Error('Error: boom'))).toBe('boom');
    expect(readableError('plain message')).toBe('plain message');
    expect(readableError(42)).toBe('42');
    expect(readableError(new Error('Error invoking remote method \'x\': Error: nested'))).toBe('nested');
  });
});

describe('discovered tool host display', () => {
  // Simulates i18next returning the key for an untranslated host.
  const missingKeyT = (key: string): string => key;

  it('falls back to the catalogue display name for tool hosts without a translation key', () => {
    expect(translatedHost(missingKeyT as never, 'trae')).toBe('TRAE IDE');
    expect(translatedHost(missingKeyT as never, 'cursor')).toBe('Cursor');
    expect(translatedHost(missingKeyT as never, 'windsurf')).toBe('Windsurf');
  });

  it('every host produced by the catalog resolves to a name, a mark and a badge class', () => {
    for (const tool of AI_TOOL_LOCATIONS) {
      const host = toolHostKey(tool.key);
      if (host === 'codex' || host === 'claude' || host === 'workbuddy') continue;
      expect(translatedHost(missingKeyT as never, host), host).not.toBe(host);
      expect(toolMarkText(host), host).toMatch(/^[A-Z]{1,2}$/);
      expect(isToolHost(host), host).toBe(true);
    }
  });

  it('first-class hosts and custom are not treated as discovered tools', () => {
    expect(isToolHost('codex')).toBe(false);
    expect(isToolHost('claude')).toBe(false);
    expect(isToolHost('workbuddy')).toBe(false);
    expect(isToolHost('custom')).toBe(false);
  });

  it('tool aliases resolve to the canonical host and its display details', () => {
    expect(toolHostKey('trae_cn_builtin')).toBe('trae');
    expect(translatedHost(missingKeyT as never, 'trae')).toBe('TRAE IDE');
    expect(toolColorClass('trae')).toBe('root-tool-trae');
  });

  it('renders tool host names through a real i18next instance like the app does', async () => {
    const i18n = createInstance();
    await i18n.init({
      resources, lng: 'zh-CN', fallbackLng: 'zh-CN', supportedLngs: ['zh-CN', 'en-US'],
      ns: [...namespaces], defaultNS, interpolation: { escapeValue: false }, returnNull: false
    });
    const t = i18n.t.bind(i18n);
    expect(translatedHost(t, 'trae')).toBe('TRAE IDE');
    expect(translatedHost(t, 'cursor')).toBe('Cursor');
    expect(translatedHost(t, 'codex')).toBe('Codex');
    expect(translatedHost(t, 'custom')).toBe('通用 / 自定义');
  });

  it('matches brand icons for discovered platforms and falls back to none for custom', () => {
    for (const host of ['trae', 'cursor', 'claude', 'codex', 'workbuddy', 'windsurf', 'trae_cn_builtin', 'omp_agent']) {
      expect(typeof toolIcon(host), host).toBe('string');
      expect((toolIcon(host) ?? '').length, host).toBeGreaterThan(0);
    }
    // Distinct hosts resolve to distinct assets, so the registry does not
    // collapse platforms onto one shared icon.
    expect(toolIcon('trae')).not.toBe(toolIcon('cursor'));
  });

  it('leaves hosts without a shipped icon to the initials fallback', () => {
    expect(toolIcon('qclaw')).toBeUndefined();
    expect(toolIcon('easyclaw')).toBeUndefined();
    expect(toolIcon('autoclaw')).toBeUndefined();
    expect(toolIcon('custom')).toBeUndefined();
    expect(toolMarkText('qclaw')).toBe('Q');
  });
});