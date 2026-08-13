import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HostPlatform, SkillRoot, SkillScope, SkillSourceType } from '../shared/types';
import type { DatabaseContext } from './db/database';
import { createId, localizeMessage, normalizeFsPath, nowIso, pathExists, type MessageTranslator } from './utils';

interface RootSeed {
  label: string;
  path: string;
  host: HostPlatform;
  scope: SkillScope;
  sourceType: SkillSourceType;
  writable: boolean;
  recursive: boolean;
  discovered: boolean;
  always?: boolean;
}

export class RootsService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly userDataPath: string,
    private readonly translate?: MessageTranslator
  ) {}

  async initializeDefaults(): Promise<void> {
    const home = os.homedir();
    const seeds: RootSeed[] = [
      { label: 'Codex 通用 Skills', path: path.join(home, '.agents', 'skills'), host: 'codex', scope: 'user', sourceType: 'user', writable: true, recursive: true, discovered: true },
      { label: 'Codex 用户 Skills', path: path.join(home, '.codex', 'skills'), host: 'codex', scope: 'user', sourceType: 'user', writable: true, recursive: true, discovered: true },
      { label: 'Claude 用户 Skills', path: path.join(home, '.claude', 'skills'), host: 'claude', scope: 'user', sourceType: 'user', writable: true, recursive: true, discovered: true },
      { label: 'WorkBuddy 用户 Skills', path: path.join(home, '.workbuddy', 'skills'), host: 'workbuddy', scope: 'user', sourceType: 'user', writable: true, recursive: true, discovered: true },
      { label: 'Codex 插件缓存', path: path.join(home, '.codex', 'plugins', 'cache'), host: 'codex', scope: 'plugin', sourceType: 'cache', writable: false, recursive: true, discovered: true },
      { label: 'Claude 插件缓存', path: path.join(home, '.claude', 'plugins', 'cache'), host: 'claude', scope: 'plugin', sourceType: 'cache', writable: false, recursive: true, discovered: true },
      { label: 'Claude 市场', path: path.join(home, '.claude', 'plugins', 'marketplaces'), host: 'claude', scope: 'plugin', sourceType: 'marketplace', writable: false, recursive: true, discovered: true },
      { label: 'WorkBuddy 插件', path: path.join(home, '.workbuddy', 'plugins'), host: 'workbuddy', scope: 'plugin', sourceType: 'plugin', writable: false, recursive: true, discovered: true },
      { label: '工作台回收站', path: path.join(this.userDataPath, 'trash'), host: 'custom', scope: 'system', sourceType: 'trash', writable: false, recursive: true, discovered: true, always: true }
    ];

    for (const seed of seeds) {
      if (process.env.SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS === '1' && !seed.always) continue;
      if (!seed.always && !(await pathExists(seed.path))) continue;
      if (seed.always) await fs.mkdir(seed.path, { recursive: true });
      this.upsertSeed(seed);
    }
  }

  async addTestRootIfConfigured(): Promise<void> {
    const testRoot = process.env.SKILL_WORKBENCH_TEST_ROOT;
    if (!testRoot) return;
    await this.add(testRoot);
  }

  list(): SkillRoot[] {
    const rows = this.database.sqlite.prepare('SELECT * FROM roots ORDER BY source_type = ? DESC, label COLLATE NOCASE').all('user') as Array<Record<string, unknown>>;
    return rows.map(mapRoot);
  }

  async add(rootPath: string): Promise<SkillRoot[]> {
    const resolved = path.resolve(rootPath.trim());
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat?.isDirectory()) throw new Error(localizeMessage(this.translate, 'error.folderRequired', '请选择存在的目录'));
    const identity = inferRootIdentity(resolved);
    this.upsertSeed({
      label: path.basename(resolved) || resolved,
      path: resolved,
      host: identity.host,
      scope: 'project',
      sourceType: 'project',
      writable: true,
      recursive: true,
      discovered: false
    });
    return this.list();
  }

  remove(id: string): SkillRoot[] {
    const row = this.database.sqlite.prepare('SELECT discovered, source_type FROM roots WHERE id = ?').get(id) as { discovered: number; source_type: string } | undefined;
    if (!row) return this.list();
    if (row.discovered || row.source_type === 'trash') {
      throw new Error(localizeMessage(this.translate, 'error.protectedRootRemove', '自动发现和回收站根目录不能移除'));
    }
    this.database.sqlite.transaction(() => {
      this.database.sqlite.prepare('DELETE FROM skills WHERE root_id = ?').run(id);
      this.database.sqlite.prepare('DELETE FROM roots WHERE id = ?').run(id);
    })();
    return this.list();
  }

  private upsertSeed(seed: RootSeed): void {
    const normalizedPath = normalizeFsPath(seed.path);
    this.database.sqlite.prepare(`
      INSERT INTO roots (
        id, label, path, normalized_path, host, scope, source_type, writable,
        recursive, enabled, discovered, last_scanned_at, skill_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, 0, ?)
      ON CONFLICT(normalized_path) DO UPDATE SET
        label = excluded.label, host = excluded.host, scope = excluded.scope,
        source_type = excluded.source_type, writable = excluded.writable,
        recursive = excluded.recursive, discovered = MAX(roots.discovered, excluded.discovered)
    `).run(
      createId(), seed.label, path.resolve(seed.path), normalizedPath, seed.host, seed.scope,
      seed.sourceType, Number(seed.writable), Number(seed.recursive), Number(seed.discovered), nowIso()
    );
  }
}

function inferRootIdentity(rootPath: string): { host: HostPlatform } {
  const normalized = rootPath.replace(/\\/g, '/').toLocaleLowerCase('en-US');
  if (normalized.includes('/.claude/')) return { host: 'claude' };
  if (normalized.includes('/.workbuddy/')) return { host: 'workbuddy' };
  if (normalized.includes('/.codex/') || normalized.includes('/.agents/')) return { host: 'codex' };
  return { host: 'custom' };
}

function mapRoot(row: Record<string, unknown>): SkillRoot {
  return {
    id: String(row.id),
    label: String(row.label),
    labelCode: rootLabelCode(row),
    path: String(row.path),
    host: row.host as HostPlatform,
    scope: row.scope as SkillScope,
    sourceType: row.source_type as SkillSourceType,
    writable: Boolean(row.writable),
    recursive: Boolean(row.recursive),
    enabled: Boolean(row.enabled),
    discovered: Boolean(row.discovered),
    lastScannedAt: row.last_scanned_at ? String(row.last_scanned_at) : null,
    skillCount: Number(row.skill_count)
  };
}

function rootLabelCode(row: Record<string, unknown>): string | undefined {
  if (!Boolean(row.discovered)) return undefined;
  const host = row.host as HostPlatform;
  const sourceType = row.source_type as SkillSourceType;
  const normalizedPath = String(row.path).replace(/\\/g, '/').toLocaleLowerCase('en-US');
  if (sourceType === 'trash') return 'trash';
  if (host === 'codex' && sourceType === 'user') {
    return normalizedPath.endsWith('/.agents/skills') ? 'codexShared' : 'codexUser';
  }
  if (host === 'claude' && sourceType === 'user') return 'claudeUser';
  if (host === 'workbuddy' && sourceType === 'user') return 'workbuddyUser';
  if (host === 'codex' && sourceType === 'cache') return 'codexPluginCache';
  if (host === 'claude' && sourceType === 'cache') return 'claudePluginCache';
  if (host === 'claude' && sourceType === 'marketplace') return 'claudeMarketplace';
  if (host === 'workbuddy' && sourceType === 'plugin') return 'workbuddyPlugins';
  return undefined;
}

export { mapRoot };
