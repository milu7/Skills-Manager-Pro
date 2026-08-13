import { promises as fs } from 'node:fs';
import path from 'node:path';
import fastGlob from 'fast-glob';
import { parseDocument } from 'yaml';
import type {
  HostPlatform,
  LocalAnalysisResult,
  ScanProgress,
  SkillDiagnostic,
  SkillFileEntry,
  SkillRoot,
  SkillScope,
  SkillSourceType,
  SkillState
} from '../shared/types';
import { analyzeDocument, classifyFile, healthFromDiagnostics, isTextFile, markdownLinks, stringValue, suggestCategory } from './analysis/local-analyzer';
import type { DatabaseContext } from './db/database';
import type { SkillRow } from './db/schema';
import { mapRoot } from './roots-service';
import { parseSkillDocument } from './skill-document';
import { SkillRepository } from './skill-repository';
import { createId, detectTextFormat, errorMessage, isPathInside, normalizeFsPath, nowIso, pathExists, sha256, toPosixPath } from './utils';
import { PluginManifestService } from './plugin-manifest-service';

interface IndexedSkill {
  id: string;
  rootId: string;
  host: HostPlatform;
  scope: SkillScope;
  sourceType: SkillSourceType;
  state: SkillState;
  skillPath: string;
  realPath: string;
  originalPath: string | null;
  folderName: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  suggestedCategory: string;
  tagsJson: string;
  writable: boolean;
  parentPlugin: string | null;
  contentHash: string;
  mainFileHash: string;
  normalizedContentHash: string;
  searchText: string;
  frontmatterJson: string;
  bodyCache: string;
  filesJson: string;
  fileCount: number;
  sizeBytes: number;
  lineCount: number;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  hasAgentMetadata: boolean;
  health: string;
  diagnosticsJson: string;
  updatedAt: string;
  indexedAt: string;
  scanToken: string;
}

type ProgressListener = (progress: ScanProgress) => void;

export class ScannerService {
  private progress: ScanProgress = emptyProgress();
  private listeners = new Set<ProgressListener>();
  private pendingScan: Promise<ScanProgress> | null = null;
  private readonly pluginManifests = new PluginManifestService();

  constructor(
    private readonly database: DatabaseContext,
    private readonly repository: SkillRepository
  ) {}

  getProgress(): ScanProgress {
    return { ...this.progress };
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  scanAll(): Promise<ScanProgress> {
    if (this.pendingScan) return this.pendingScan;
    const roots = (this.database.sqlite.prepare('SELECT * FROM roots WHERE enabled = 1 ORDER BY label').all() as Array<Record<string, unknown>>).map(mapRoot);
    this.pendingScan = this.performScan(roots).finally(() => {
      this.pendingScan = null;
    });
    return this.pendingScan;
  }

  scanRoots(rootIds: string[]): Promise<ScanProgress> {
    if (this.pendingScan) return this.pendingScan;
    const uniqueIds = [...new Set(rootIds)];
    if (uniqueIds.length === 0) return Promise.resolve(this.getProgress());
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const roots = (this.database.sqlite.prepare(`SELECT * FROM roots WHERE enabled = 1 AND id IN (${placeholders})`).all(...uniqueIds) as Array<Record<string, unknown>>).map(mapRoot);
    this.pendingScan = this.performScan(roots).finally(() => {
      this.pendingScan = null;
    });
    return this.pendingScan;
  }

  async rescanSkill(skillId: string): Promise<LocalAnalysisResult> {
    const row = this.repository.getRow(skillId);
    const rootRow = this.database.sqlite.prepare('SELECT * FROM roots WHERE id = ?').get(row.rootId) as Record<string, unknown> | undefined;
    if (!rootRow) throw new Error('Skill 根目录不存在');
    const root = mapRoot(rootRow);
    const token = createId();
    const indexed = await this.indexSkill(root, path.join(row.path, 'SKILL.md'), token, row);
    this.upsertIndexed(indexed);
    this.recomputeDuplicates();
    const refreshed = this.repository.get(skillId);
    return {
      skillId,
      health: refreshed.health,
      diagnostics: refreshed.diagnostics,
      suggestedCategory: refreshed.suggestedCategory,
      duplicateKind: refreshed.duplicateKind,
      duplicateGroup: refreshed.duplicateGroup,
      analyzedAt: nowIso()
    };
  }

  private async performScan(roots: SkillRoot[]): Promise<ScanProgress> {
    const startedAt = nowIso();
    this.setProgress({
      running: true,
      phase: '准备扫描',
      completedRoots: 0,
      totalRoots: roots.length,
      discoveredSkills: 0,
      startedAt,
      finishedAt: null,
      error: null
    });
    try {
      await this.pluginManifests.refresh();
      for (let index = 0; index < roots.length; index += 1) {
        const root = roots[index];
        if (!root) continue;
        this.setProgress({ ...this.progress, phase: `扫描 ${root.label}` });
        await this.scanRoot(root);
        this.setProgress({ ...this.progress, completedRoots: index + 1 });
      }
      this.recomputeDuplicates();
      this.setProgress({ ...this.progress, phase: '索引就绪', running: false, finishedAt: nowIso() });
    } catch (error) {
      this.setProgress({ ...this.progress, phase: '扫描失败', running: false, finishedAt: nowIso(), error: errorMessage(error) });
    }
    return this.getProgress();
  }

  private async scanRoot(root: SkillRoot): Promise<void> {
    if (!(await pathExists(root.path))) {
      this.database.sqlite.prepare('UPDATE roots SET last_scanned_at = ?, skill_count = 0 WHERE id = ?').run(nowIso(), root.id);
      return;
    }
    const scanToken = createId();
    const patterns = root.sourceType === 'project'
      ? ['SKILL.md', '**/{.agents,.codex,.claude,.workbuddy}/skills/**/SKILL.md']
      : ['**/SKILL.md'];
    const ignores = [
      '**/node_modules/**', '**/.git/**', '**/.svn/**', '**/.hg/**',
      '**/sessions/**', '**/session-cache/**', '**/.session-cache/**', '**/.trash/**'
    ];
    if (root.sourceType === 'project') {
      ignores.push('**/backup/**', '**/backups/**', '**/.backup/**', '**/.backups/**');
    }
    const mainFiles = await fastGlob(patterns, {
      cwd: root.path,
      absolute: true,
      onlyFiles: true,
      dot: true,
      unique: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      ignore: ignores
    });

    let rootCount = 0;
    let cursor = 0;
    // Directory enumeration and file parsing are I/O bound. A bounded worker pool
    // keeps large plugin trees responsive without opening every Skill at once.
    const workerCount = Math.min(12, mainFiles.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < mainFiles.length) {
        const mainFile = mainFiles[cursor];
        cursor += 1;
        if (!mainFile) continue;
        try {
          const existing = this.repository.findRowByNormalizedPath(normalizeFsPath(path.dirname(mainFile)));
          const indexed = await this.indexSkill(root, mainFile, scanToken, existing);
          // better-sqlite3 is synchronous, so writes remain serialized on this thread.
          this.upsertIndexed(indexed);
          rootCount += 1;
          this.setProgress({ ...this.progress, discoveredSkills: this.progress.discoveredSkills + 1 });
        } catch (error) {
          // One malformed or inaccessible Skill must not stop the remaining inventory.
          console.warn(`Failed to index ${mainFile}:`, error);
        }
      }
    });
    await Promise.all(workers);
    this.database.sqlite.transaction(() => {
      this.database.sqlite.prepare('DELETE FROM skills WHERE root_id = ? AND scan_token <> ?').run(root.id, scanToken);
      this.database.sqlite.prepare('UPDATE roots SET last_scanned_at = ?, skill_count = ? WHERE id = ?').run(nowIso(), rootCount, root.id);
    })();
  }

  private async indexSkill(root: SkillRoot, mainFile: string, scanToken: string, existing?: SkillRow): Promise<IndexedSkill> {
    const skillPath = path.dirname(mainFile);
    const folderName = path.basename(skillPath);
    const realPath = await fs.realpath(skillPath).catch(() => skillPath);
    const escapedSymlink = !isPathInside(root.path, realPath);
    const identity = inferIdentity(root, skillPath);
    const manifestIdentity = this.pluginManifests.classify(identity.host, skillPath, identity.sourceType);
    if (manifestIdentity.parentPlugin) {
      identity.parentPlugin = manifestIdentity.parentPlugin;
      identity.sourceType = manifestIdentity.sourceType;
      identity.state = manifestIdentity.state;
      identity.scope = manifestIdentity.sourceType === 'builtin' ? 'system' : 'plugin';
      identity.writable = false;
    }
    const mainBuffer = await fs.readFile(mainFile);
    const format = detectTextFormat(mainBuffer);
    const parsed = parseSkillDocument(format.text);
    const fileStat = await fs.stat(mainFile);
    const inventory = await inventoryFiles(skillPath, identity.writable && !escapedSymlink);
    const agentMetadata = await readAgentMetadata(skillPath);
    const frontmatter = parsed.frontmatter;
    const workbuddyName = identity.host === 'workbuddy' ? stringValue(frontmatter.title) : '';
    const workbuddyDescription = identity.host === 'workbuddy' ? stringValue(frontmatter.summary) : '';
    const name = stringValue(frontmatter.name) || workbuddyName || folderName;
    const description = stringValue(frontmatter.description) || workbuddyDescription || '暂无说明';
    const displayOverride = this.database.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(`display:${normalizeFsPath(skillPath)}`) as { value: string } | undefined;
    const displayName = displayOverride?.value || agentMetadata.displayName || workbuddyName || name;
    const brokenLinks = await inspectLinks(skillPath, parsed.body);
    const diagnostics = analyzeDocument({
      host: identity.host,
      folderName,
      parsed,
      mainFileBytes: mainBuffer.length,
      hasScripts: inventory.hasScripts,
      binaryCount: inventory.binaryCount,
      agentMetadataError: agentMetadata.error,
      brokenLinks,
      escapedSymlink
    });
    const mainFileHash = sha256(mainBuffer);
    const normalizedContentHash = simHash(normalizeSkillText(format.text));
    const contentHash = mainFileHash;
    const category = existing?.category ?? '未分类';
    const tagsJson = existing?.tagsJson ?? '[]';
    const suggestedCategory = suggestCategory(name, description, parsed.body);
    return {
      id: existing?.id ?? createId(),
      rootId: root.id,
      host: identity.host,
      scope: identity.scope,
      sourceType: identity.sourceType,
      state: identity.state,
      skillPath,
      realPath,
      originalPath: existing?.originalPath ?? null,
      folderName,
      name,
      displayName,
      description,
      category,
      suggestedCategory,
      tagsJson,
      writable: identity.writable && !escapedSymlink,
      parentPlugin: identity.parentPlugin,
      contentHash,
      mainFileHash,
      normalizedContentHash,
      searchText: `${name}\n${displayName}\n${description}\n${parsed.body}\n${skillPath}`,
      frontmatterJson: JSON.stringify(frontmatter),
      bodyCache: parsed.body,
      filesJson: JSON.stringify(inventory.files),
      fileCount: inventory.files.length,
      sizeBytes: inventory.sizeBytes,
      lineCount: format.text.split(/\r?\n/).length,
      hasScripts: inventory.hasScripts,
      hasReferences: inventory.hasReferences,
      hasAssets: inventory.hasAssets,
      hasAgentMetadata: agentMetadata.exists,
      health: healthFromDiagnostics(diagnostics),
      diagnosticsJson: JSON.stringify(diagnostics),
      updatedAt: fileStat.mtime.toISOString(),
      indexedAt: nowIso(),
      scanToken
    };
  }

  private upsertIndexed(skill: IndexedSkill): void {
    this.database.sqlite.prepare(`
      INSERT INTO skills (
        id, root_id, host, scope, source_type, state, path, normalized_path, real_path,
        original_path, folder_name, name, display_name, description, category, suggested_category,
        tags_json, writable, parent_plugin, content_hash, main_file_hash, normalized_content_hash,
        search_text, frontmatter_json, body_cache, files_json, file_count, size_bytes, line_count,
        has_scripts, has_references, has_assets, has_agent_metadata, health, diagnostics_json,
        duplicate_group, duplicate_kind, updated_at, indexed_at, scan_token
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?
      )
      ON CONFLICT(normalized_path) DO UPDATE SET
        root_id = excluded.root_id, host = excluded.host, scope = excluded.scope,
        source_type = excluded.source_type, state = excluded.state, path = excluded.path,
        real_path = excluded.real_path, folder_name = excluded.folder_name, name = excluded.name,
        display_name = excluded.display_name, description = excluded.description,
        suggested_category = excluded.suggested_category, writable = excluded.writable,
        parent_plugin = excluded.parent_plugin, content_hash = excluded.content_hash,
        main_file_hash = excluded.main_file_hash, normalized_content_hash = excluded.normalized_content_hash,
        search_text = excluded.search_text, frontmatter_json = excluded.frontmatter_json,
        body_cache = excluded.body_cache, files_json = excluded.files_json,
        file_count = excluded.file_count, size_bytes = excluded.size_bytes, line_count = excluded.line_count,
        has_scripts = excluded.has_scripts, has_references = excluded.has_references,
        has_assets = excluded.has_assets, has_agent_metadata = excluded.has_agent_metadata,
        health = excluded.health, diagnostics_json = excluded.diagnostics_json,
        updated_at = excluded.updated_at, indexed_at = excluded.indexed_at, scan_token = excluded.scan_token
    `).run(
      skill.id, skill.rootId, skill.host, skill.scope, skill.sourceType, skill.state, skill.skillPath,
      normalizeFsPath(skill.skillPath), skill.realPath, skill.originalPath, skill.folderName, skill.name,
      skill.displayName, skill.description, skill.category, skill.suggestedCategory, skill.tagsJson,
      Number(skill.writable), skill.parentPlugin, skill.contentHash, skill.mainFileHash,
      skill.normalizedContentHash, skill.searchText, skill.frontmatterJson, skill.bodyCache, skill.filesJson,
      skill.fileCount, skill.sizeBytes, skill.lineCount, Number(skill.hasScripts), Number(skill.hasReferences),
      Number(skill.hasAssets), Number(skill.hasAgentMetadata), skill.health, skill.diagnosticsJson,
      skill.updatedAt, skill.indexedAt, skill.scanToken
    );
  }

  private recomputeDuplicates(): void {
    const rows = this.database.sqlite.prepare(`
      SELECT id, name, content_hash, normalized_content_hash FROM skills WHERE state <> 'trash'
    `).all() as Array<{ id: string; name: string; content_hash: string; normalized_content_hash: string }>;
    const assignments = new Map<string, { kind: 'exact' | 'near' | 'name'; group: string }>();
    assignGroups(rows, (row) => row.content_hash, 'exact', assignments);
    assignNearGroups(rows, assignments);
    assignGroups(rows, (row) => normalizeLogicalName(row.name), 'name', assignments);
    this.database.sqlite.transaction(() => {
      this.database.sqlite.prepare('UPDATE skills SET duplicate_group = NULL, duplicate_kind = NULL').run();
      const update = this.database.sqlite.prepare('UPDATE skills SET duplicate_group = ?, duplicate_kind = ? WHERE id = ?');
      for (const [id, value] of assignments) update.run(value.group, value.kind, id);
    })();
  }

  private setProgress(progress: ScanProgress): void {
    this.progress = progress;
    for (const listener of this.listeners) listener(this.getProgress());
  }
}

export function inferIdentity(root: SkillRoot, skillPath: string): {
  host: HostPlatform;
  scope: SkillScope;
  sourceType: SkillSourceType;
  state: SkillState;
  writable: boolean;
  parentPlugin: string | null;
} {
  const normalized = toPosixPath(skillPath).toLocaleLowerCase('en-US');
  let host: HostPlatform = root.host;
  if (normalized.includes('/.claude/')) host = 'claude';
  else if (normalized.includes('/.workbuddy/')) host = 'workbuddy';
  else if (normalized.includes('/.codex/')) host = 'codex';
  else if (normalized.includes('/.agents/')) host = 'codex';

  let sourceType = root.sourceType;
  let scope = root.scope;
  let writable = root.writable;
  let state: SkillState = root.sourceType === 'trash' ? 'trash' : 'active';
  if (/(?:^|\/)\.system(?:\/|$)/.test(normalized) || normalized.includes('/builtin/')) {
    sourceType = 'builtin'; scope = 'system'; writable = false;
  } else if (/(?:^|\/)(?:backups?|\.backups?|plugin-backup-[^/]*)(?:\/|$)/.test(normalized)) {
    sourceType = 'backup'; writable = false;
  } else if (normalized.includes('/plugins/cache/') || normalized.includes('/plugin-cache/')) {
    sourceType = 'cache'; scope = 'plugin'; writable = false;
  } else if (normalized.includes('/marketplaces/') || normalized.includes('/marketplace/')) {
    sourceType = 'marketplace'; scope = 'plugin'; writable = false;
  } else if (normalized.includes('/plugins/')) {
    sourceType = 'plugin'; scope = 'plugin'; writable = false;
  }
  if (root.sourceType === 'trash') {
    sourceType = 'trash'; scope = 'system'; writable = false; state = 'trash';
  }
  return { host, scope, sourceType, state, writable, parentPlugin: inferParentPlugin(skillPath) };
}

export function inferParentPlugin(skillPath: string): string | null {
  const parts = toPosixPath(skillPath).split('/');
  const pluginIndex = parts.findIndex((part) => part.toLocaleLowerCase('en-US') === 'plugins');
  if (pluginIndex < 0) return null;
  const tail = parts.slice(pluginIndex + 1);
  const lower = tail.map((part) => part.toLocaleLowerCase('en-US'));
  if (lower[0] === 'cache' && tail[1] && tail[2]) return `${tail[2]}@${tail[1]}`;
  if (lower[0] === 'marketplaces' && tail[1]) {
    const pluginsIndex = lower.indexOf('plugins', 2);
    const pluginName = pluginsIndex >= 0 ? tail[pluginsIndex + 1] : tail[2];
    return pluginName ? `${pluginName}@${tail[1]}` : tail[1];
  }
  const firstMeaningful = tail.find((part) => !['cache', 'marketplaces', 'skills', 'data'].includes(part.toLocaleLowerCase('en-US')));
  return firstMeaningful ?? null;
}

async function inventoryFiles(skillPath: string, writable: boolean): Promise<{
  files: SkillFileEntry[];
  sizeBytes: number;
  binaryCount: number;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
}> {
  const files: SkillFileEntry[] = [];
  const queue = [''];
  let sizeBytes = 0;
  let binaryCount = 0;
  let hasScripts = false;
  let hasReferences = false;
  let hasAssets = false;
  while (queue.length > 0 && files.length < 2000) {
    const relativeDirectory = queue.shift() ?? '';
    const absoluteDirectory = path.join(skillPath, relativeDirectory);
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name.startsWith('.skill-workbench')) continue;
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        queue.push(relative);
        continue;
      }
      if (!entry.isFile()) continue;
      const absolute = path.join(skillPath, relative);
      const stat = await fs.stat(absolute).catch(() => null);
      if (!stat) continue;
      const kind = classifyFile(relative);
      const text = isTextFile(relative) || kind === 'main' || kind === 'metadata';
      if (!text) binaryCount += 1;
      if (kind === 'script') hasScripts = true;
      if (kind === 'reference') hasReferences = true;
      if (kind === 'asset') hasAssets = true;
      sizeBytes += stat.size;
      files.push({
        relativePath: toPosixPath(relative),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        kind,
        text,
        editable: writable && text && kind !== 'script'
      });
    }
  }
  files.sort((left, right) => fileKindOrder(left.kind) - fileKindOrder(right.kind) || left.relativePath.localeCompare(right.relativePath));
  return { files, sizeBytes, binaryCount, hasScripts, hasReferences, hasAssets };
}

async function readAgentMetadata(skillPath: string): Promise<{ exists: boolean; displayName: string; error?: string }> {
  for (const relative of [path.join('agents', 'openai.yaml'), path.join('agents', 'openai.yml')]) {
    const target = path.join(skillPath, relative);
    if (!(await pathExists(target))) continue;
    try {
      const raw = await fs.readFile(target, 'utf8');
      const document = parseDocument(raw, { prettyErrors: true, strict: false });
      if (document.errors.length > 0) return { exists: true, displayName: '', error: document.errors[0]?.message ?? 'YAML 无法解析' };
      const value = document.toJS() as { interface?: { display_name?: unknown } } | null;
      return { exists: true, displayName: stringValue(value?.interface?.display_name) };
    } catch (error) {
      return { exists: true, displayName: '', error: errorMessage(error) };
    }
  }
  return { exists: false, displayName: '' };
}

async function inspectLinks(skillPath: string, body: string): Promise<Array<{ path: string; outside: boolean }>> {
  const results: Array<{ path: string; outside: boolean }> = [];
  for (const link of markdownLinks(body).slice(0, 100)) {
    if (/^(?:https?:|mailto:|data:|#)/i.test(link)) continue;
    const withoutAnchor = link.split('#')[0]?.split('?')[0] ?? '';
    if (!withoutAnchor) continue;
    let decoded = withoutAnchor;
    try { decoded = decodeURIComponent(withoutAnchor); } catch { /* retain raw path */ }
    const target = path.resolve(skillPath, decoded);
    const outside = !isPathInside(skillPath, target);
    if (outside || !(await pathExists(target))) results.push({ path: link, outside });
  }
  return results;
}

function normalizeSkillText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/<!--.*?-->/gs, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .toLocaleLowerCase('en-US');
}

function normalizeLogicalName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '-');
}

function assignGroups(
  rows: Array<{ id: string; name: string; content_hash: string; normalized_content_hash: string }>,
  keyOf: (row: { id: string; name: string; content_hash: string; normalized_content_hash: string }) => string,
  kind: 'exact' | 'near' | 'name',
  assignments: Map<string, { kind: 'exact' | 'near' | 'name'; group: string }>
): void {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row.id);
    groups.set(key, group);
  }
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue;
    const group = `${kind}-${sha256(key).slice(0, 12)}`;
    for (const id of ids) {
      if (!assignments.has(id)) assignments.set(id, { kind, group });
    }
  }
}

function assignNearGroups(
  rows: Array<{ id: string; name: string; content_hash: string; normalized_content_hash: string }>,
  assignments: Map<string, { kind: 'exact' | 'near' | 'name'; group: string }>
): void {
  const parent = new Map(rows.map((row) => [row.id, row.id]));
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  const buckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const hash = row.normalized_content_hash.padStart(16, '0');
    for (let band = 0; band < 4; band += 1) {
      const key = `${band}:${hash.slice(band * 4, band * 4 + 4)}`;
      const values = buckets.get(key) ?? [];
      for (const candidate of values) {
        if (candidate.content_hash !== row.content_hash && hammingDistance(hash, candidate.normalized_content_hash.padStart(16, '0')) <= 5) {
          union(row.id, candidate.id);
        }
      }
      values.push(row);
      buckets.set(key, values);
    }
  }
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const root = find(row.id);
    const values = groups.get(root) ?? [];
    values.push(row.id);
    groups.set(root, values);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const group = `near-${sha256(ids.slice().sort().join(':')).slice(0, 12)}`;
    for (const id of ids) if (!assignments.has(id)) assignments.set(id, { kind: 'near', group });
  }
}

function simHash(text: string): string {
  const tokens = text.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
  const weights = new Int32Array(64);
  const counts = new Map<string, number>();
  for (const rawToken of tokens.slice(0, 80_000)) {
    const token = rawToken.toLocaleLowerCase('en-US');
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  for (const [token, count] of counts) {
    const digest = sha256(token);
    const value = BigInt(`0x${digest.slice(0, 16)}`);
    for (let bit = 0; bit < 64; bit += 1) weights[bit] = (weights[bit] ?? 0) + (((value >> BigInt(bit)) & 1n) === 1n ? count : -count);
  }
  let result = 0n;
  for (let bit = 0; bit < 64; bit += 1) if ((weights[bit] ?? 0) >= 0) result |= 1n << BigInt(bit);
  return result.toString(16).padStart(16, '0');
}

function hammingDistance(left: string, right: string): number {
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let distance = 0;
  while (value > 0n) {
    value &= value - 1n;
    distance += 1;
  }
  return distance;
}

function fileKindOrder(kind: SkillFileEntry['kind']): number {
  return { main: 0, metadata: 1, reference: 2, asset: 3, script: 4, other: 5 }[kind];
}

function emptyProgress(): ScanProgress {
  return { running: false, phase: '尚未扫描', completedRoots: 0, totalRoots: 0, discoveredSkills: 0, startedAt: null, finishedAt: null, error: null };
}
