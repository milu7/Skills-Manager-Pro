import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const roots = sqliteTable(
  'roots',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    host: text('host').notNull(),
    scope: text('scope').notNull(),
    sourceType: text('source_type').notNull(),
    writable: integer('writable', { mode: 'boolean' }).notNull(),
    recursive: integer('recursive', { mode: 'boolean' }).notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    discovered: integer('discovered', { mode: 'boolean' }).notNull(),
    lastScannedAt: text('last_scanned_at'),
    skillCount: integer('skill_count').notNull().default(0),
    createdAt: text('created_at').notNull()
  },
  (table) => [uniqueIndex('roots_normalized_path_unique').on(table.normalizedPath)]
);

export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    host: text('host').notNull(),
    scope: text('scope').notNull(),
    sourceType: text('source_type').notNull(),
    state: text('state').notNull(),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    realPath: text('real_path').notNull(),
    originalPath: text('original_path'),
    folderName: text('folder_name').notNull(),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull().default('未分类'),
    suggestedCategory: text('suggested_category').notNull().default('未分类'),
    tagsJson: text('tags_json').notNull().default('[]'),
    writable: integer('writable', { mode: 'boolean' }).notNull(),
    parentPlugin: text('parent_plugin'),
    contentHash: text('content_hash').notNull(),
    mainFileHash: text('main_file_hash').notNull(),
    normalizedContentHash: text('normalized_content_hash').notNull(),
    searchText: text('search_text').notNull(),
    frontmatterJson: text('frontmatter_json').notNull(),
    bodyCache: text('body_cache').notNull(),
    filesJson: text('files_json').notNull(),
    fileCount: integer('file_count').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    lineCount: integer('line_count').notNull(),
    hasScripts: integer('has_scripts', { mode: 'boolean' }).notNull(),
    hasReferences: integer('has_references', { mode: 'boolean' }).notNull(),
    hasAssets: integer('has_assets', { mode: 'boolean' }).notNull(),
    hasAgentMetadata: integer('has_agent_metadata', { mode: 'boolean' }).notNull(),
    health: text('health').notNull(),
    diagnosticsJson: text('diagnostics_json').notNull(),
    duplicateGroup: text('duplicate_group'),
    duplicateKind: text('duplicate_kind'),
    updatedAt: text('updated_at').notNull(),
    indexedAt: text('indexed_at').notNull(),
    scanToken: text('scan_token').notNull()
  },
  (table) => [
    uniqueIndex('skills_normalized_path_unique').on(table.normalizedPath),
    index('skills_host_idx').on(table.host),
    index('skills_health_idx').on(table.health),
    index('skills_source_idx').on(table.sourceType),
    index('skills_scan_token_idx').on(table.scanToken),
    index('skills_content_hash_idx').on(table.contentHash)
  ]
);

export const snapshots = sqliteTable(
  'snapshots',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    newline: text('newline').notNull(),
    hasBom: integer('has_bom', { mode: 'boolean' }).notNull(),
    reason: text('reason').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => [index('snapshots_skill_idx').on(table.skillId)]
);

export const actions = sqliteTable(
  'actions',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').references(() => skills.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    path: text('path').notNull(),
    relativePath: text('relative_path'),
    summary: text('summary').notNull(),
    beforeHash: text('before_hash'),
    afterHash: text('after_hash'),
    afterContent: text('after_content'),
    snapshotId: text('snapshot_id'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    reversible: integer('reversible', { mode: 'boolean' }).notNull()
  },
  (table) => [index('actions_created_idx').on(table.createdAt)]
);

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  protocol: text('protocol').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  timeoutMs: integer('timeout_ms').notNull(),
  headersJson: text('headers_json').notNull(),
  encryptedApiKey: text('encrypted_api_key'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  lastTestedAt: text('last_tested_at'),
  lastTestStatus: text('last_test_status'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const aiAnalyses = sqliteTable(
  'ai_analyses',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    providerName: text('provider_name').notNull(),
    model: text('model').notNull(),
    protocol: text('protocol').notNull(),
    contentHash: text('content_hash').notNull(),
    promptVersion: text('prompt_version').notNull(),
    cacheKey: text('cache_key').notNull(),
    payloadJson: text('payload_json').notNull(),
    inputFilesJson: text('input_files_json').notNull(),
    inputBytes: integer('input_bytes').notNull(),
    outputLocale: text('output_locale').notNull().default('zh-CN'),
    createdAt: text('created_at').notNull()
  },
  (table) => [
    uniqueIndex('ai_analyses_cache_key_unique').on(table.cacheKey),
    index('ai_analyses_skill_idx').on(table.skillId)
  ]
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const skillNotes = sqliteTable('skill_notes', {
  skillId: text('skill_id').primaryKey().references(() => skills.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  updatedAt: text('updated_at').notNull()
});

export const skillNoteImages = sqliteTable(
  'skill_note_images',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    content: blob('content', { mode: 'buffer' }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => [index('skill_note_images_skill_idx').on(table.skillId)]
);

export type RootRow = typeof roots.$inferSelect;
export type SkillRow = typeof skills.$inferSelect;
export type ProviderRow = typeof providers.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
