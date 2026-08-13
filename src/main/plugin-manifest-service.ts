import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HostPlatform, SkillSourceType, SkillState } from '../shared/types';
import { normalizeFsPath } from './utils';

interface InstalledPlugin {
  id: string;
  installPath: string;
  builtin: boolean;
  enabled: boolean | null;
}

export interface PluginClassification {
  parentPlugin: string | null;
  sourceType: SkillSourceType;
  state: SkillState;
}

export class PluginManifestService {
  private installed = new Map<HostPlatform, InstalledPlugin[]>();

  async refresh(): Promise<void> {
    this.installed.clear();
    await Promise.all([
      this.loadInstalledManifest('workbuddy', path.join(os.homedir(), '.workbuddy')),
      this.loadInstalledManifest('claude', path.join(os.homedir(), '.claude'))
    ]);
  }

  classify(host: HostPlatform, skillPath: string, fallbackSource: SkillSourceType): PluginClassification {
    const normalizedSkillPath = normalizeFsPath(skillPath);
    const matches = (this.installed.get(host) ?? [])
      .filter((plugin) => isSameOrInside(normalizedSkillPath, normalizeFsPath(plugin.installPath)))
      .sort((left, right) => right.installPath.length - left.installPath.length);
    const plugin = matches[0];
    if (!plugin) return { parentPlugin: null, sourceType: fallbackSource, state: 'active' };
    return {
      parentPlugin: plugin.id,
      sourceType: plugin.builtin ? 'builtin' : 'plugin',
      state: plugin.enabled === false ? 'disabled' : 'active'
    };
  }

  private async loadInstalledManifest(host: 'workbuddy' | 'claude', hostRoot: string): Promise<void> {
    const manifestPath = path.join(hostRoot, 'plugins', 'installed_plugins.json');
    const raw = await fs.readFile(manifestPath, 'utf8').catch(() => '');
    if (!raw) return;
    let manifest: unknown;
    try { manifest = JSON.parse(stripBom(raw)); } catch { return; }
    const plugins = objectValue(manifest)?.plugins;
    const pluginMap = objectValue(plugins);
    if (!pluginMap) return;
    const enabled = await readEnabledPlugins(path.join(hostRoot, 'settings.json'));
    const installed: InstalledPlugin[] = [];
    for (const [id, entries] of Object.entries(pluginMap)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const value = objectValue(entry);
        if (!value || typeof value.installPath !== 'string' || !value.installPath.trim()) continue;
        installed.push({
          id,
          installPath: path.resolve(value.installPath),
          builtin: Boolean(value.workbuddySeedManaged) || /@(?:workbuddy|claude)-builtin$/i.test(id),
          enabled: enabled.has(id) ? enabled.get(id) ?? null : null
        });
      }
    }
    this.installed.set(host, installed);
  }
}

async function readEnabledPlugins(settingsPath: string): Promise<Map<string, boolean>> {
  const raw = await fs.readFile(settingsPath, 'utf8').catch(() => '');
  if (!raw) return new Map();
  try {
    const settings = objectValue(JSON.parse(stripBom(raw)));
    const values = objectValue(settings?.enabledPlugins);
    if (!values) return new Map();
    return new Map(Object.entries(values).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
  } catch {
    return new Map();
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function isSameOrInside(candidate: string, parent: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}
