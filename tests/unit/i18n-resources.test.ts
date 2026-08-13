import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resources } from '../../src/shared/i18n/resources';

describe('i18n resources', () => {
  it('keeps the same translation keys and interpolation variables in both locales', () => {
    const chinese = flattenLeaves(resources['zh-CN']);
    const english = flattenLeaves(resources['en-US']);

    expect([...english.keys()].sort()).toEqual([...chinese.keys()].sort());
    for (const key of chinese.keys()) {
      expect(chinese.get(key)?.trim(), `zh-CN: ${key}`).not.toBe('');
      expect(english.get(key)?.trim(), `en-US: ${key}`).not.toBe('');
      expect(interpolationVariables(english.get(key) ?? ''), key)
        .toEqual(interpolationVariables(chinese.get(key) ?? ''));
    }
  });

  it('resolves every literal renderer translation key', () => {
    const available = flattenLeaves(resources['zh-CN']);
    const usedKeys = collectRendererTranslationKeys(path.resolve('src/renderer'));

    expect(usedKeys.size).toBeGreaterThan(0);
    expect([...usedKeys].filter((key) => !available.has(key))).toEqual([]);
  });

  it('contains every static main-process message key used by services and IPC', () => {
    const mainResources = flattenLeaves(resources['zh-CN'].messages.main);
    const usedKeys = collectMainMessageKeys(path.resolve('src/main'));

    expect(usedKeys.size).toBeGreaterThan(0);
    expect([...usedKeys].filter((key) => !mainResources.has(key))).toEqual([]);
  });
});

function flattenLeaves(value: unknown, prefix = '', result = new Map<string, string>()): Map<string, string> {
  if (typeof value === 'string') {
    result.set(prefix, value);
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    flattenLeaves(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function interpolationVariables(value: string): string[] {
  return [...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1] ?? '').sort();
}

function collectMainMessageKeys(directory: string): Set<string> {
  const keys = new Set<string>();
  const patterns = [
    /this\.message\(\s*['"]([^'"]+)['"]/g,
    /localizeMessage\(\s*[^,]+,\s*['"]([^'"]+)['"]/g,
    /localization\.t\(\s*['"]messages:main\.([^'"]+)['"]/g
  ];
  for (const filePath of listTypeScriptFiles(directory)) {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (match[1]) keys.add(match[1]);
      }
    }
  }
  return keys;
}

function collectRendererTranslationKeys(directory: string): Set<string> {
  const keys = new Set<string>();
  for (const filePath of listTypeScriptFiles(directory)) {
    const source = readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
      const key = match[1];
      if (!key) continue;
      const separator = key.indexOf(':');
      keys.add(separator >= 0 ? `${key.slice(0, separator)}.${key.slice(separator + 1)}` : `common.${key}`);
    }
  }
  return keys;
}

function listTypeScriptFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listTypeScriptFiles(entryPath));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push(entryPath);
  }
  return result;
}
