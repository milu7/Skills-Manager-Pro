import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('PluginManifestService', () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-plugin-manifest-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(home, { recursive: true, force: true });
  });

  it('maps WorkBuddy installed plugin paths to builtin and disabled state', async () => {
    const installPath = path.join(home, '.workbuddy', 'plugins', 'cache', 'workbuddy-builtin', 'demo', '1.0.0');
    await fs.mkdir(path.join(home, '.workbuddy', 'plugins'), { recursive: true });
    await fs.writeFile(path.join(home, '.workbuddy', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'demo@workbuddy-builtin': [{ scope: 'user', installPath, workbuddySeedManaged: true }]
      }
    }));
    await fs.writeFile(path.join(home, '.workbuddy', 'settings.json'), JSON.stringify({
      enabledPlugins: { 'demo@workbuddy-builtin': false }
    }));
    const { PluginManifestService } = await import('../../src/main/plugin-manifest-service');
    const service = new PluginManifestService();
    await service.refresh();

    expect(service.classify('workbuddy', path.join(installPath, 'skills', 'helper'), 'cache')).toEqual({
      parentPlugin: 'demo@workbuddy-builtin',
      sourceType: 'builtin',
      state: 'disabled'
    });
  });

  it('keeps unmatched cache entries on their fallback classification', async () => {
    const { PluginManifestService } = await import('../../src/main/plugin-manifest-service');
    const service = new PluginManifestService();
    await service.refresh();
    expect(service.classify('codex', path.join(home, '.codex', 'plugins', 'cache', 'demo'), 'cache')).toEqual({
      parentPlugin: null,
      sourceType: 'cache',
      state: 'active'
    });
  });
});
