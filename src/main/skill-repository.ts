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
import { localizeMessage, safeJsonParse, type MessageTranslator } from './utils';
import { eq } from 'drizzle-orm';

export class SkillRepository {
  constructor(
    private readonly database: DatabaseContext,
    private readonly getResolvedLocale: () => SupportedLocale = () => 'zh-CN',
    private readonly translate?: MessageTranslator
  ) {}

  list(filters: SkillListFilters = {}): SkillListResult {
    const rows = this.database.orm.select().from(skillsTable).all();
    const all = rows.map(mapSkillRow);
    const query = filters.query?.trim().toLocaleLowerCase('zh-CN');
    let items = all.filter((skill) => {
      if (filters.hosts?.length && !filters.hosts.includes(skill.host)) return false;
      if (filters.sourceTypes?.length && !filters.sourceTypes.includes(skill.sourceType)) return false;
      if (filters.health?.length && !filters.health.includes(skill.health)) return false;
      if (filters.category && skill.category !== filters.category) return false;
      if (filters.writable !== undefined && skill.writable !== filters.writable) return false;
      if (filters.duplicateOnly && !skill.duplicateKind) return false;
      if (filters.state && skill.state !== filters.state) return false;
      if (query) {
        const corpus = `${skill.name}\n${skill.displayName}\n${skill.description}\n${skill.path}\n${skill.tags.join(' ')}`.toLocaleLowerCase('zh-CN');
        if (!corpus.includes(query)) {
          const row = rows.find((candidate) => candidate.id === skill.id);
          if (!row?.searchText.toLocaleLowerCase('zh-CN').includes(query)) return false;
        }
      }
      return true;
    });

    items.sort((left, right) => {
      const healthOrder = { error: 0, warning: 1, healthy: 2 };
      const healthDifference = healthOrder[left.health] - healthOrder[right.health];
      if (healthDifference !== 0) return healthDifference;
      return left.displayName.localeCompare(right.displayName, this.getResolvedLocale());
    });
    const total = items.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 5000;
    items = items.slice(offset, offset + limit);
    return {
      items,
      total,
      stats: buildStats(all, this.getResolvedLocale()),
      scanInProgress: false
    };
  }

  get(id: string): SkillDetails {
    const row = this.database.orm.select().from(skillsTable).where(eq(skillsTable.id, id)).get();
    if (!row) throw new Error(localizeMessage(this.translate, 'error.skillNotFound', 'Skill 不存在或已被外部移除'));
    const skill = mapSkillRow(row);
    const family = buildFamily(this.database.orm.select().from(skillsTable).all(), skill);
    return {
      ...skill,
      frontmatter: safeJsonParse<Record<string, unknown>>(row.frontmatterJson, {}),
      body: row.bodyCache,
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

function buildFamily(rows: SkillRow[], skill: SkillInstallation): SkillFamily | null {
  const logicalName = normalizeFamilyName(skill.name);
  const installations = rows
    .map(mapSkillRow)
    .filter((candidate) => candidate.state !== 'trash' && normalizeFamilyName(candidate.name) === logicalName);
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

function normalizeFamilyName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '-');
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

function buildStats(skills: SkillInstallation[], locale: SupportedLocale): SkillStats {
  const active = skills.filter((skill) => skill.state === 'active' || skill.state === 'unknown');
  const categories = new Map<string, number>();
  const bySource: Partial<Record<SkillSourceType, number>> = {};
  const byHost: Record<HostPlatform, number> = { codex: 0, claude: 0, workbuddy: 0, custom: 0 };
  for (const skill of active) {
    byHost[skill.host] += 1;
    bySource[skill.sourceType] = (bySource[skill.sourceType] ?? 0) + 1;
    categories.set(skill.category, (categories.get(skill.category) ?? 0) + 1);
  }
  return {
    total: active.length,
    writable: active.filter((skill) => skill.writable).length,
    warnings: active.filter((skill) => skill.health === 'warning').length,
    errors: active.filter((skill) => skill.health === 'error').length,
    duplicates: active.filter((skill) => skill.duplicateKind !== null).length,
    disabled: skills.filter((skill) => skill.state === 'disabled').length,
    trashed: skills.filter((skill) => skill.state === 'trash').length,
    byHost,
    bySource,
    categories: [...categories.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, locale))
  };
}
