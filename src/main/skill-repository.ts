import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  AiAnalysis,
  AiAnalysisPayload,
  AiProtocol,
  HostPlatform,
  SkillDetails,
  SkillFileEntry,
  SkillHealth,
  SkillInstallation,
  SkillFamily,
  SkillListFilters,
  SkillListResult,
  SkillScope,
  SkillSourceType,
  SkillState,
  SkillStats,
  SupportedLocale
} from '../shared/types';
import type { DatabaseContext } from './db/database';
import { skills as skillsTable, type SkillRow } from './db/schema';
import { detectTextFormat, localizeMessage, normalizeLogicalName, safeJsonParse, type MessageTranslator } from './utils';
import { eq } from 'drizzle-orm';

/**
 * Lightweight projection of the `skills` table used by list queries.
 * Deliberately excludes the heavy text columns (search_text, body_cache,
 * frontmatter_json, files_json, diagnostics_json) that the list UI never reads.
 */
const LIST_COLUMNS = `
  id, root_id, host, scope, source_type, state, path, real_path, original_path, folder_name,
  name, display_name, description, category, suggested_category, tags_json, writable, parent_plugin,
  content_hash, file_count, size_bytes, line_count, has_scripts, has_references, has_assets,
  has_agent_metadata, health, duplicate_group, duplicate_kind, updated_at, indexed_at
`;

interface ListRow {
  id: string;
  root_id: string;
  host: string;
  scope: string;
  source_type: string;
  state: string;
  path: string;
  real_path: string;
  original_path: string | null;
  folder_name: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  suggested_category: string;
  tags_json: string;
  writable: number;
  parent_plugin: string | null;
  content_hash: string;
  file_count: number;
  size_bytes: number;
  line_count: number;
  has_scripts: number;
  has_references: number;
  has_assets: number;
  has_agent_metadata: number;
  health: string;
  duplicate_group: string | null;
  duplicate_kind: string | null;
  updated_at: string;
  indexed_at: string;
}

interface FamilyCandidate {
  id: string;
  name: string;
  state: string;
  contentHash: string;
  host: HostPlatform;
}

export class SkillRepository {
  constructor(
    private readonly database: DatabaseContext,
    private readonly getResolvedLocale: () => SupportedLocale = () => 'zh-CN',
    private readonly translate?: MessageTranslator
  ) {}

  list(filters: SkillListFilters = {}): SkillListResult {
    // Filtering happens in SQLite; only matching rows are returned and only the
    // lightweight columns are projected, so list calls never load body_cache /
    // search_text / files_json / diagnostics_json into the JS heap.
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.hosts?.length) {
      conditions.push(`host IN (${filters.hosts.map(() => '?').join(', ')})`);
      params.push(...filters.hosts);
    }
    if (filters.sourceTypes?.length) {
      conditions.push(`source_type IN (${filters.sourceTypes.map(() => '?').join(', ')})`);
      params.push(...filters.sourceTypes);
    }
    if (filters.health?.length) {
      conditions.push(`health IN (${filters.health.map(() => '?').join(', ')})`);
      params.push(...filters.health);
    }
    if (filters.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters.writable !== undefined) {
      conditions.push('writable = ?');
      params.push(filters.writable ? 1 : 0);
    }
    if (filters.duplicateOnly) conditions.push('duplicate_kind IS NOT NULL');
    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    const query = filters.query?.trim().toLocaleLowerCase('zh-CN');
    if (query) {
      // LIKE wildcards are escaped so the match keeps the substring semantics
      // of the previous JS `includes` check.
      const like = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      conditions.push(
        `(name LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ` +
          `OR path LIKE ? ESCAPE '\\' OR tags_json LIKE ? ESCAPE '\\' OR search_text LIKE ? ESCAPE '\\')`
      );
      params.push(like, like, like, like, like, like);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

    const rows = this.database.sqlite
      .prepare(`SELECT ${LIST_COLUMNS} FROM skills${where}`)
      .all(...params) as ListRow[];
    const items = rows.map(mapListRow);

    // Sorting stays in JS: SQLite's BINARY collation cannot reproduce the
    // locale-aware displayName order (e.g. pinyin collation for zh-CN).
    items.sort((left, right) => {
      const healthOrder = { error: 0, warning: 1, healthy: 2 };
      const healthDifference = healthOrder[left.health] - healthOrder[right.health];
      if (healthDifference !== 0) return healthDifference;
      return left.displayName.localeCompare(right.displayName, this.getResolvedLocale());
    });
    const total = items.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 5000;
    return {
      items: items.slice(offset, offset + limit),
      total,
      stats: buildStats(this.database, this.getResolvedLocale()),
      scanInProgress: false
    };
  }

  get(id: string): SkillDetails {
    const row = this.database.orm.select().from(skillsTable).where(eq(skillsTable.id, id)).get();
    if (!row) throw new Error(localizeMessage(this.translate, 'error.skillNotFound', 'Skill 不存在或已被外部移除'));
    const skill = mapSkillRow(row);
    const family = buildFamily(this.loadFamilyCandidates(), skill);
    return {
      ...skill,
      frontmatter: safeJsonParse<Record<string, unknown>>(row.frontmatterJson, {}),
      body: readBodyFromDisk(row),
      mainFileHash: row.mainFileHash,
      files: safeJsonParse<SkillFileEntry[]>(row.filesJson, []),
      family,
      latestAiAnalysis: this.latestAnalysis(id, row.contentHash)
    };
  }

  getRow(id: string): SkillRow {
    const row = this.database.orm.select().from(skillsTable).where(eq(skillsTable.id, id)).get();
    if (!row) throw new Error(localizeMessage(this.translate, 'error.skillNotFound', 'Skill 不存在或已被外部移除'));
    return row;
  }

  findRowByNormalizedPath(normalizedPath: string): SkillRow | undefined {
    return this.database.orm.select().from(skillsTable).where(eq(skillsTable.normalizedPath, normalizedPath)).get();
  }

  /**
   * Family detection scans only the light identity columns instead of loading
   * the full rows, avoiding a second full-table read of the heavy text columns.
   */
  private loadFamilyCandidates(): FamilyCandidate[] {
    const rows = this.database.sqlite
      .prepare(`SELECT id, name, state, content_hash, host FROM skills WHERE state <> 'trash'`)
      .all() as Array<{ id: string; name: string; state: string; content_hash: string; host: string }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      state: row.state,
      contentHash: row.content_hash,
      host: row.host as HostPlatform
    }));
  }

  latestAnalysis(skillId: string, currentHash: string): AiAnalysis | null {
    const resolvedLocale = this.getResolvedLocale();
    const row = this.database.sqlite.prepare(`
      SELECT * FROM ai_analyses
      WHERE skill_id = ?
      ORDER BY CASE WHEN output_locale = ? THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1
    `).get(skillId, resolvedLocale) as Record<string, unknown> | undefined;
    if (!row) return null;
    const payload = safeJsonParse<AiAnalysisPayload>(String(row.payload_json), {
      summary: '', capabilities: [], recommendedCategory: '未分类', tags: [], triggerQuality: 'weak',
      compatibilityNotes: [], riskFlags: [], improvementSuggestions: [], confidence: 0
    });
    return {
      id: String(row.id),
      skillId: String(row.skill_id),
      providerId: String(row.provider_id),
      providerName: String(row.provider_name),
      model: String(row.model),
      protocol: row.protocol as AiProtocol,
      contentHash: String(row.content_hash),
      stale: String(row.content_hash) !== currentHash,
      inputFiles: safeJsonParse<string[]>(String(row.input_files_json), []),
      inputBytes: Number(row.input_bytes),
      outputLocale: row.output_locale === 'en-US' ? 'en-US' : 'zh-CN',
      createdAt: String(row.created_at),
      ...payload
    };
  }
}

/**
 * Reads the SKILL.md body straight from disk (optimization plan #8): the
 * database no longer stores a second full-text copy, and details are fetched
 * one Skill at a time, so the synchronous read (~1 ms for typical files) is
 * negligible. Missing or unreadable files fall back to an empty body — the
 * same degradation the scanner diagnostics already report.
 */
function readBodyFromDisk(row: SkillRow): string {
  try {
    return detectTextFormat(readFileSync(path.join(row.path, 'SKILL.md'))).text;
  } catch {
    return '';
  }
}

function buildFamily(rows: FamilyCandidate[], skill: SkillInstallation): SkillFamily | null {
  const logicalName = normalizeLogicalName(skill.name);
  const installations = rows.filter(
    (candidate) => candidate.state !== 'trash' && normalizeLogicalName(candidate.name) === logicalName
  );
  if (installations.length < 2) return null;
  const hashes = [...new Set(installations.map((candidate) => candidate.contentHash))];
  return {
    id: `family:${logicalName}`,
    logicalName,
    installationIds: installations.map((candidate) => candidate.id),
    hosts: [...new Set(installations.map((candidate) => candidate.host))],
    contentHashes: hashes,
    mergeAssessment: hashes.length === 1 ? 'exact_content' : 'review_required'
  };
}

export function mapSkillRow(row: SkillRow): SkillInstallation {
  return {
    id: row.id,
    rootId: row.rootId,
    host: row.host as HostPlatform,
    scope: row.scope as SkillScope,
    sourceType: row.sourceType as SkillSourceType,
    state: row.state as SkillState,
    path: row.path,
    realPath: row.realPath,
    originalPath: row.originalPath,
    folderName: row.folderName,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    category: row.category,
    suggestedCategory: row.suggestedCategory,
    tags: safeJsonParse<string[]>(row.tagsJson, []),
    writable: row.writable,
    parentPlugin: row.parentPlugin,
    contentHash: row.contentHash,
    fileCount: row.fileCount,
    sizeBytes: row.sizeBytes,
    lineCount: row.lineCount,
    hasScripts: row.hasScripts,
    hasReferences: row.hasReferences,
    hasAssets: row.hasAssets,
    hasAgentMetadata: row.hasAgentMetadata,
    health: row.health as SkillHealth,
    diagnostics: safeJsonParse(row.diagnosticsJson, []),
    duplicateGroup: row.duplicateGroup,
    duplicateKind: (row.duplicateKind as SkillInstallation['duplicateKind']) ?? null,
    updatedAt: row.updatedAt,
    indexedAt: row.indexedAt
  };
}

/**
 * Maps a lightweight list row. `diagnostics` is intentionally empty here:
 * the list UI never reads it (details are fetched separately), and parsing
 * diagnostics_json for every row was a per-list-call cost with no consumer.
 */
function mapListRow(row: ListRow): SkillInstallation {
  return {
    id: row.id,
    rootId: row.root_id,
    host: row.host as HostPlatform,
    scope: row.scope as SkillScope,
    sourceType: row.source_type as SkillSourceType,
    state: row.state as SkillState,
    path: row.path,
    realPath: row.real_path,
    originalPath: row.original_path,
    folderName: row.folder_name,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    suggestedCategory: row.suggested_category,
    tags: safeJsonParse<string[]>(row.tags_json, []),
    writable: row.writable === 1,
    parentPlugin: row.parent_plugin,
    contentHash: row.content_hash,
    fileCount: row.file_count,
    sizeBytes: row.size_bytes,
    lineCount: row.line_count,
    hasScripts: row.has_scripts === 1,
    hasReferences: row.has_references === 1,
    hasAssets: row.has_assets === 1,
    hasAgentMetadata: row.has_agent_metadata === 1,
    health: row.health as SkillHealth,
    diagnostics: [],
    duplicateGroup: row.duplicate_group,
    duplicateKind: (row.duplicate_kind as SkillInstallation['duplicateKind']) ?? null,
    updatedAt: row.updated_at,
    indexedAt: row.indexed_at
  };
}

/** Aggregates sidebar stats in SQLite instead of scanning every row in JS. */
function buildStats(database: DatabaseContext, locale: SupportedLocale): SkillStats {
  const scalar = database.sqlite.prepare(`
    SELECT
      SUM(CASE WHEN state IN ('active','unknown') THEN 1 ELSE 0 END) AS total,
      SUM(CASE WHEN state IN ('active','unknown') AND writable = 1 THEN 1 ELSE 0 END) AS writable,
      SUM(CASE WHEN state IN ('active','unknown') AND health = 'warning' THEN 1 ELSE 0 END) AS warnings,
      SUM(CASE WHEN state IN ('active','unknown') AND health = 'error' THEN 1 ELSE 0 END) AS errors,
      SUM(CASE WHEN state IN ('active','unknown') AND duplicate_kind IS NOT NULL THEN 1 ELSE 0 END) AS duplicates,
      SUM(CASE WHEN state = 'disabled' THEN 1 ELSE 0 END) AS disabled,
      SUM(CASE WHEN state = 'trash' THEN 1 ELSE 0 END) AS trashed
    FROM skills
  `).get() as {
    total: number | null;
    writable: number | null;
    warnings: number | null;
    errors: number | null;
    duplicates: number | null;
    disabled: number | null;
    trashed: number | null;
  };

  const grouped = database.sqlite.prepare(`
    SELECT host, source_type, category, COUNT(*) AS count
    FROM skills
    WHERE state IN ('active','unknown')
    GROUP BY host, source_type, category
  `).all() as Array<{ host: string; source_type: string; category: string; count: number }>;

  const byHost: Record<string, number> = {};
  const bySource: Partial<Record<SkillSourceType, number>> = {};
  const categories = new Map<string, number>();
  for (const row of grouped) {
    byHost[row.host as HostPlatform] = (byHost[row.host as HostPlatform] ?? 0) + row.count;
    bySource[row.source_type as SkillSourceType] = (bySource[row.source_type as SkillSourceType] ?? 0) + row.count;
    categories.set(row.category, (categories.get(row.category) ?? 0) + row.count);
  }
  return {
    total: scalar.total ?? 0,
    writable: scalar.writable ?? 0,
    warnings: scalar.warnings ?? 0,
    errors: scalar.errors ?? 0,
    duplicates: scalar.duplicates ?? 0,
    disabled: scalar.disabled ?? 0,
    trashed: scalar.trashed ?? 0,
    byHost,
    bySource,
    categories: [...categories.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, locale))
  };
}
