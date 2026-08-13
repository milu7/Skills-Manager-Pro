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
  }
] as const;
