export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS roots (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, path TEXT NOT NULL,
        normalized_path TEXT NOT NULL UNIQUE, host TEXT NOT NULL, scope TEXT NOT NULL,
        source_type TEXT NOT NULL, writable INTEGER NOT NULL, recursive INTEGER NOT NULL,
        enabled INTEGER NOT NULL, discovered INTEGER NOT NULL, last_scanned_at TEXT,
        skill_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL, host TEXT NOT NULL, scope TEXT NOT NULL,
        source_type TEXT NOT NULL, state TEXT NOT NULL, path TEXT NOT NULL,
        normalized_path TEXT NOT NULL UNIQUE, real_path TEXT NOT NULL, original_path TEXT,
        folder_name TEXT NOT NULL, name TEXT NOT NULL, display_name TEXT NOT NULL,
        description TEXT NOT NULL, category TEXT NOT NULL DEFAULT '未分类',
        suggested_category TEXT NOT NULL DEFAULT '未分类', tags_json TEXT NOT NULL DEFAULT '[]',
        writable INTEGER NOT NULL, parent_plugin TEXT, content_hash TEXT NOT NULL,
        main_file_hash TEXT NOT NULL, normalized_content_hash TEXT NOT NULL,
        search_text TEXT NOT NULL, frontmatter_json TEXT NOT NULL, body_cache TEXT NOT NULL,
        files_json TEXT NOT NULL, file_count INTEGER NOT NULL, size_bytes INTEGER NOT NULL,
        line_count INTEGER NOT NULL, has_scripts INTEGER NOT NULL, has_references INTEGER NOT NULL,
        has_assets INTEGER NOT NULL, has_agent_metadata INTEGER NOT NULL, health TEXT NOT NULL,
        diagnostics_json TEXT NOT NULL, duplicate_group TEXT, duplicate_kind TEXT,
        updated_at TEXT NOT NULL, indexed_at TEXT NOT NULL, scan_token TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS skills_host_idx ON skills(host);
      CREATE INDEX IF NOT EXISTS skills_health_idx ON skills(health);
      CREATE INDEX IF NOT EXISTS skills_source_idx ON skills(source_type);
      CREATE INDEX IF NOT EXISTS skills_scan_token_idx ON skills(scan_token);
      CREATE INDEX IF NOT EXISTS skills_content_hash_idx ON skills(content_hash);
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, relative_path TEXT NOT NULL,
        content TEXT NOT NULL, content_hash TEXT NOT NULL, newline TEXT NOT NULL,
        has_bom INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS snapshots_skill_idx ON snapshots(skill_id);
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY, skill_id TEXT, action TEXT NOT NULL, path TEXT NOT NULL,
        relative_path TEXT, summary TEXT NOT NULL, before_hash TEXT, after_hash TEXT,
        after_content TEXT, snapshot_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL, reversible INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS actions_created_idx ON actions(created_at);
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, protocol TEXT NOT NULL,
        base_url TEXT NOT NULL, model TEXT NOT NULL, timeout_ms INTEGER NOT NULL,
        headers_json TEXT NOT NULL, encrypted_api_key TEXT, enabled INTEGER NOT NULL,
        last_tested_at TEXT, last_test_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL, model TEXT NOT NULL, protocol TEXT NOT NULL,
        content_hash TEXT NOT NULL, prompt_version TEXT NOT NULL, cache_key TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL, input_files_json TEXT NOT NULL, input_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ai_analyses_skill_idx ON ai_analyses(skill_id);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS skill_notes (
        skill_id TEXT PRIMARY KEY, body TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS skill_note_images (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, filename TEXT NOT NULL,
        mime_type TEXT NOT NULL, content BLOB NOT NULL, size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS skill_note_images_skill_idx ON skill_note_images(skill_id);
    `
  },
  {
    version: 3,
    sql: `
      ALTER TABLE ai_analyses ADD COLUMN output_locale TEXT NOT NULL DEFAULT 'zh-CN';
      INSERT OR IGNORE INTO settings (key, value, updated_at)
      VALUES ('locale.preference', 'zh-CN', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `
  },
  {
    version: 4,
    sql: `
      -- #6: restore real foreign keys (the schema had none, so the
      -- foreign_keys=ON pragma was a no-op) and drop orphaned rows in one
      -- migration. SQLite cannot ALTER in constraints, so every child table
      -- is rebuilt with REFERENCES skills(id) ON DELETE CASCADE. The rebuild
      -- order is safe with foreign_keys=ON: old tables carry no constraints,
      -- so DROP TABLE never trips a reference, and the copy INSERT filters to
      -- existing skill ids (the one-time orphan cleanup). Rebuild the children
      -- only; the skills table itself stays untouched.
      CREATE TABLE snapshots_new (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL,
        newline TEXT NOT NULL, has_bom INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO snapshots_new (id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at)
        SELECT id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at
        FROM snapshots WHERE skill_id IN (SELECT id FROM skills);
      DROP TABLE snapshots;
      ALTER TABLE snapshots_new RENAME TO snapshots;
      CREATE INDEX IF NOT EXISTS snapshots_skill_idx ON snapshots(skill_id);

      CREATE TABLE actions_new (
        id TEXT PRIMARY KEY, skill_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
        action TEXT NOT NULL, path TEXT NOT NULL, relative_path TEXT, summary TEXT NOT NULL,
        before_hash TEXT, after_hash TEXT, after_content TEXT, snapshot_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, reversible INTEGER NOT NULL
      );
      INSERT INTO actions_new (id, skill_id, action, path, relative_path, summary, before_hash, after_hash, after_content, snapshot_id, metadata_json, created_at, reversible)
        SELECT id, skill_id, action, path, relative_path, summary, before_hash, after_hash, after_content, snapshot_id, metadata_json, created_at, reversible
        FROM actions WHERE skill_id IS NULL OR skill_id IN (SELECT id FROM skills);
      DROP TABLE actions;
      ALTER TABLE actions_new RENAME TO actions;
      CREATE INDEX IF NOT EXISTS actions_created_idx ON actions(created_at);

      CREATE TABLE skill_notes_new (
        skill_id TEXT PRIMARY KEY REFERENCES skills(id) ON DELETE CASCADE,
        body TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
      );
      INSERT INTO skill_notes_new (skill_id, body, updated_at)
        SELECT skill_id, body, updated_at FROM skill_notes WHERE skill_id IN (SELECT id FROM skills);
      DROP TABLE skill_notes;
      ALTER TABLE skill_notes_new RENAME TO skill_notes;

      CREATE TABLE skill_note_images_new (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        filename TEXT NOT NULL, mime_type TEXT NOT NULL, content BLOB NOT NULL,
        size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO skill_note_images_new (id, skill_id, filename, mime_type, content, size_bytes, created_at)
        SELECT id, skill_id, filename, mime_type, content, size_bytes, created_at
        FROM skill_note_images WHERE skill_id IN (SELECT id FROM skills);
      DROP TABLE skill_note_images;
      ALTER TABLE skill_note_images_new RENAME TO skill_note_images;
      CREATE INDEX IF NOT EXISTS skill_note_images_skill_idx ON skill_note_images(skill_id);

      CREATE TABLE ai_analyses_new (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL, provider_name TEXT NOT NULL, model TEXT NOT NULL,
        protocol TEXT NOT NULL, content_hash TEXT NOT NULL, prompt_version TEXT NOT NULL,
        cache_key TEXT NOT NULL, payload_json TEXT NOT NULL, input_files_json TEXT NOT NULL,
        input_bytes INTEGER NOT NULL, output_locale TEXT NOT NULL DEFAULT 'zh-CN', created_at TEXT NOT NULL
      );
      INSERT INTO ai_analyses_new (id, skill_id, provider_id, provider_name, model, protocol, content_hash, prompt_version, cache_key, payload_json, input_files_json, input_bytes, output_locale, created_at)
        SELECT id, skill_id, provider_id, provider_name, model, protocol, content_hash, prompt_version, cache_key, payload_json, input_files_json, input_bytes, output_locale, created_at
        FROM ai_analyses WHERE skill_id IN (SELECT id FROM skills);
      DROP TABLE ai_analyses;
      ALTER TABLE ai_analyses_new RENAME TO ai_analyses;
      CREATE UNIQUE INDEX IF NOT EXISTS ai_analyses_cache_key_unique ON ai_analyses(cache_key);
      CREATE INDEX IF NOT EXISTS ai_analyses_skill_idx ON ai_analyses(skill_id);

      -- #7: one-time retention caps for existing databases (keep the newest N
      -- per skill; actions capped at a global total). Runtime pruning in
      -- retention.ts keeps the same caps going forward.
      DELETE FROM snapshots WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY skill_id ORDER BY created_at DESC) AS rn FROM snapshots
        ) WHERE rn <= 20
      );
      DELETE FROM actions WHERE id IN (SELECT id FROM actions ORDER BY created_at DESC LIMIT -1 OFFSET 5000);
      DELETE FROM ai_analyses WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY skill_id ORDER BY created_at DESC) AS rn FROM ai_analyses
        ) WHERE rn <= 10
      );
    `
  },
  {
    version: 5,
    sql: `
      -- #8: body_cache moves off the database. The main file lives on disk and
      -- details are read on demand (SkillRepository.get reads SKILL.md via
      -- detectTextFormat), so the full text no longer needs a second copy in
      -- SQLite. search_text keeps the single full-text copy that powers the
      -- LIKE search. This clears the historical rows; new scans write ''.
      UPDATE skills SET body_cache = '';
    `
  }
] as const;
