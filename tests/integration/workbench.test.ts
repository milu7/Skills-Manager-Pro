import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import http, { type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3/win32-x64';
import { AiService } from '../../src/main/ai-service';
import { closeDatabase, openDatabase, type DatabaseContext } from '../../src/main/db/database';
import { migrations } from '../../src/main/db/migrations';
import { pruneAnalyses } from '../../src/main/db/retention';
import { OperationsService } from '../../src/main/operations-service';
import { NoteService } from '../../src/main/note-service';
import type { RuntimeProvider } from '../../src/main/provider-service';
import { RootsService } from '../../src/main/roots-service';
import { ScannerService } from '../../src/main/scanner-service';
import { SkillRepository } from '../../src/main/skill-repository';
import { normalizeFsPath } from '../../src/main/utils';

interface Harness {
  base: string;
  project: string;
  skillPath: string;
  database: DatabaseContext;
  repository: SkillRepository;
  scanner: ScannerService;
  operations: OperationsService;
  notes: NoteService;
  skillId: string;
}

const temporaryPaths: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  closeDatabase();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const target of temporaryPaths.splice(0)) await fs.rm(target, { recursive: true, force: true });
});

describe('workbench integration', () => {
  it('upgrades a v3 index: adds foreign keys, clears orphans, and applies retention caps', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-migration-'));
    temporaryPaths.push(base);
    const userData = path.join(base, 'user-data');
    await fs.mkdir(userData, { recursive: true });
    const databasePath = path.join(userData, 'skill-workbench.sqlite3');
    const legacy = new BetterSqlite3(databasePath);
    legacy.exec(migrations[0].sql);
    legacy.exec(migrations[1].sql);
    legacy.exec(migrations[2].sql);
    legacy.pragma('user_version = 3');

    const skillPath = path.join(base, 'project', '.agents', 'skills', 'demo');
    legacy.prepare(`
      INSERT INTO skills (id, root_id, host, scope, source_type, state, path, normalized_path, real_path,
        folder_name, name, display_name, description, category, suggested_category, tags_json, writable,
        content_hash, main_file_hash, normalized_content_hash, search_text, frontmatter_json, body_cache,
        files_json, file_count, size_bytes, line_count, has_scripts, has_references, has_assets,
        has_agent_metadata, health, diagnostics_json, updated_at, indexed_at, scan_token)
      VALUES (?, 'root', 'codex', 'user', 'user', 'active', ?, ?, ?, 'demo', 'demo', 'demo', 'desc',
        '未分类', '未分类', '[]', 1, 'content-hash', 'main-hash', 'norm-hash', 'search', '{}', 'body',
        '[]', 1, 10, 1, 0, 0, 0, 0, 'healthy', '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'token')
    `).run('skill-1', skillPath, skillPath.toLowerCase(), skillPath);
    const snapshotInsert = legacy.prepare(`
      INSERT INTO snapshots (id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at)
      VALUES (?, ?, 'SKILL.md', ?, ?, 'lf', 0, 'seed', ?)
    `);
    for (let index = 0; index < 25; index += 1) {
      const createdAt = `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`;
      snapshotInsert.run(`snap-${index}`, 'skill-1', `content-${index}`, `hash-${index}`, createdAt);
    }
    snapshotInsert.run('snap-orphan', 'missing-skill', 'orphan', 'orphan-hash', '2026-01-01T00:00:00.000Z');
    legacy.prepare(`
      INSERT INTO actions (id, skill_id, action, path, summary, metadata_json, created_at, reversible)
      VALUES (?, ?, 'edit_body', ?, 'summary', '{}', '2026-01-01T00:00:00.000Z', 1)
    `).run('action-valid', 'skill-1', skillPath);
    legacy.prepare(`
      INSERT INTO actions (id, skill_id, action, path, summary, metadata_json, created_at, reversible)
      VALUES (?, NULL, 'edit_body', ?, 'summary', '{}', '2026-01-01T00:00:00.000Z', 1)
    `).run('action-null-skill', skillPath);
    legacy.prepare(`
      INSERT INTO actions (id, skill_id, action, path, summary, metadata_json, created_at, reversible)
      VALUES (?, 'missing-skill', 'edit_body', ?, 'summary', '{}', '2026-01-01T00:00:00.000Z', 1)
    `).run('action-orphan', skillPath);
    const analysisInsert = legacy.prepare(`
      INSERT INTO ai_analyses (id, skill_id, provider_id, provider_name, model, protocol, content_hash,
        prompt_version, cache_key, payload_json, input_files_json, input_bytes, output_locale, created_at)
      VALUES (?, 'skill-1', 'provider', 'Mock', 'model', 'chat_completions', 'content-hash', 'v',
        ?, '{}', '[]', 0, 'zh-CN', ?)
    `);
    for (let index = 0; index < 12; index += 1) {
      analysisInsert.run(`analysis-${index}`, `cache-${index}`, `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`);
    }
    analysisInsert.run('analysis-orphan', 'cache-orphan', '2026-01-01T00:00:00.000Z');
    legacy.prepare("INSERT INTO skill_notes (skill_id, body, updated_at) VALUES ('skill-1', 'note', '2026-01-01T00:00:00.000Z')").run();
    legacy.prepare("INSERT INTO skill_notes (skill_id, body, updated_at) VALUES ('missing-skill', 'orphan', '2026-01-01T00:00:00.000Z')").run();
    legacy.prepare(`
      INSERT INTO skill_note_images (id, skill_id, filename, mime_type, content, size_bytes, created_at)
      VALUES ('image-1', 'skill-1', 'a.png', 'image/png', X'89504E47', 4, '2026-01-01T00:00:00.000Z')
    `).run();
    legacy.prepare(`
      INSERT INTO skill_note_images (id, skill_id, filename, mime_type, content, size_bytes, created_at)
      VALUES ('image-orphan', 'missing-skill', 'b.png', 'image/png', X'89504E47', 4, '2026-01-01T00:00:00.000Z')
    `).run();
    legacy.close();

    const upgraded = openDatabase(userData);
    expect(Number(upgraded.sqlite.pragma('user_version', { simple: true }))).toBe(5);
    const tables = upgraded.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(['skills', 'snapshots', 'actions', 'skill_notes', 'skill_note_images', 'ai_analyses']));

    // The v5 migration clears the historical body_cache (bodies now come from disk).
    expect(upgraded.sqlite.prepare("SELECT body_cache FROM skills WHERE id = 'skill-1'").get()).toEqual({ body_cache: '' });

    // Orphans are gone and retention caps applied (20 snapshots, 10 analyses).
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM snapshots').get()).toEqual({ count: 20 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM ai_analyses').get()).toEqual({ count: 10 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM actions').get()).toEqual({ count: 2 });
    expect(upgraded.sqlite.prepare('SELECT skill_id FROM actions WHERE id = ?').get('action-null-skill')).toEqual({ skill_id: null });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM skill_notes').get()).toEqual({ count: 1 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM skill_note_images').get()).toEqual({ count: 1 });

    // Foreign keys are now enforced...
    expect(() => upgraded.sqlite.prepare(`
      INSERT INTO snapshots (id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at)
      VALUES ('ghost', 'no-such-skill', 'SKILL.md', 'x', 'h', 'lf', 0, 'x', '2026-01-01T00:00:00.000Z')
    `).run()).toThrow(/FOREIGN KEY/);
    // ...and deleting a Skill cascades to all child tables.
    upgraded.sqlite.prepare("DELETE FROM skills WHERE id = 'skill-1'").run();
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM snapshots').get()).toEqual({ count: 0 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM ai_analyses').get()).toEqual({ count: 0 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM actions').get()).toEqual({ count: 1 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM skill_notes').get()).toEqual({ count: 0 });
    expect(upgraded.sqlite.prepare('SELECT COUNT(*) AS count FROM skill_note_images').get()).toEqual({ count: 0 });
  });

  it('indexes Codex metadata and never executes scripts while scanning', async () => {
    const harness = await createHarness();
    const skill = harness.repository.get(harness.skillId);
    expect(skill.host).toBe('codex');
    expect(skill.displayName).toBe('测试技能显示名');
    expect(skill.hasScripts).toBe(true);
    expect(skill.diagnostics.some((item) => item.code === 'scripts-present')).toBe(true);
    expect(await exists(path.join(harness.base, 'script-ran.txt'))).toBe(false);
  });

  it('groups same logical names into a reviewable family without assuming they can merge', async () => {
    const harness = await createHarness();
    const secondPath = path.join(harness.project, '.claude', 'skills', 'demo_skill');
    await fs.mkdir(secondPath, { recursive: true });
    await fs.writeFile(path.join(secondPath, 'SKILL.md'), '---\nname: demo_skill\ndescription: Different Claude copy.\n---\n\nDifferent body.\n');
    await harness.scanner.scanAll();
    const original = harness.repository.get(harness.skillId);
    expect(original.family).toMatchObject({
      logicalName: 'demo-skill',
      mergeAssessment: 'review_required'
    });
    expect(original.family?.installationIds).toHaveLength(2);
    expect(original.family?.hosts).toEqual(expect.arrayContaining(['codex', 'claude']));
  });

  it('skips full-row rewrites for unchanged Skills and refreshes only derived changes', async () => {
    const harness = await createHarness();

    // (a) An unchanged library is not rewritten: indexed_at / updated_at stay stable.
    const before = harness.repository.get(harness.skillId);
    await harness.scanner.scanAll();
    const after = harness.repository.get(harness.skillId);
    expect(after.indexedAt).toBe(before.indexedAt);
    expect(after.updatedAt).toBe(before.updatedAt);

    // (b) A sidecar change without touching SKILL.md still refreshes the inventory.
    await fs.appendFile(path.join(harness.skillPath, 'references', 'guide.md'), '\nExtra notes.\n', 'utf8');
    await harness.scanner.scanAll();
    const afterSidecar = harness.repository.get(harness.skillId);
    expect(afterSidecar.updatedAt).toBe(after.updatedAt);
    expect(afterSidecar.sizeBytes).toBeGreaterThan(after.sizeBytes);

    // (c) A display override with no file change still lands through rescanSkill.
    const claudePath = path.join(harness.project, '.claude', 'skills', 'helper');
    await fs.mkdir(claudePath, { recursive: true });
    await fs.writeFile(path.join(claudePath, 'SKILL.md'), '---\nname: helper\ndescription: A helper.\n---\n\nBody.\n');
    await harness.scanner.scanAll();
    const claude = harness.repository.list({ state: 'active' }).items.find((item) => item.host === 'claude');
    if (!claude) throw new Error('Claude fixture was not indexed');
    expect(claude.displayName).toBe('helper');
    harness.database.sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(`display:${normalizeFsPath(claude.path)}`, '展示助手', new Date().toISOString());
    await harness.scanner.rescanSkill(claude.id);
    expect(harness.repository.get(claude.id).displayName).toBe('展示助手');
    // The single-skill rescan leaves other rows untouched.
    expect(harness.repository.get(harness.skillId).indexedAt).toBe(afterSidecar.indexedAt);
  });

  it('assigns exact, near and name duplicate kinds with the narrowed candidate set', async () => {
    const harness = await createHarness();

    // Byte-identical copy of the fixture → exact group.
    const mirrorPath = path.join(harness.project, '.agents', 'skills', 'demo-skill-mirror');
    await fs.mkdir(mirrorPath, { recursive: true });
    await fs.copyFile(path.join(harness.skillPath, 'SKILL.md'), path.join(mirrorPath, 'SKILL.md'));
    await harness.scanner.scanAll();
    const original = harness.repository.get(harness.skillId);
    const mirror = harness.repository.list({ state: 'active' }).items.find((item) => item.folderName === 'demo-skill-mirror');
    if (!mirror) throw new Error('Mirror fixture was not indexed');
    expect(original.duplicateKind).toBe('exact');
    expect(mirror.duplicateKind).toBe('exact');
    expect(original.duplicateGroup).toBe(mirror.duplicateGroup);
    expect(original.duplicateGroup).toMatch(/^exact-/);

    // Same logical name with different content → name group.
    const claudePath = path.join(harness.project, '.claude', 'skills', 'demo-skill');
    await fs.mkdir(claudePath, { recursive: true });
    await fs.writeFile(path.join(claudePath, 'SKILL.md'), '---\nname: demo-skill\ndescription: Different Claude copy.\n---\n\nDifferent body.\n');
    await harness.scanner.scanAll();
    const claude = harness.repository.list({ state: 'active' }).items.find((item) => item.host === 'claude');
    if (!claude) throw new Error('Claude fixture was not indexed');
    expect(claude.duplicateKind).toBe('name');
    expect(claude.duplicateGroup).toMatch(/^name-/);

    // Near grouping is made deterministic by injecting identical normalized
    // hashes into the database: the unchanged rows skip the rewrite on the
    // following scan (upsert skip), so the injected values survive until
    // recomputeDuplicates reads them. near-a and near-c share content (exact
    // pair); near-b only shares the injected near hash.
    const nearBase = path.join(harness.project, '.agents', 'skills');
    for (const name of ['near-a', 'near-b']) {
      const dir = path.join(nearBase, name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: near test.\n---\n\nBody.\n`);
    }
    const nearC = path.join(nearBase, 'near-c');
    await fs.mkdir(nearC, { recursive: true });
    await fs.copyFile(path.join(nearBase, 'near-a', 'SKILL.md'), path.join(nearC, 'SKILL.md'));
    await harness.scanner.scanAll();
    const nearItems = harness.repository.list({ state: 'active' }).items.filter((item) => ['near-a', 'near-b', 'near-c'].includes(item.folderName));
    expect(nearItems).toHaveLength(3);
    const placeholders = nearItems.map(() => '?').join(', ');
    harness.database.sqlite.prepare(`UPDATE skills SET normalized_content_hash = '0000000000000000' WHERE id IN (${placeholders})`).run(...nearItems.map((item) => item.id));
    await harness.scanner.scanAll();

    const nearASkill = harness.repository.get(nearItems.find((item) => item.folderName === 'near-a')!.id);
    const nearBSkill = harness.repository.get(nearItems.find((item) => item.folderName === 'near-b')!.id);
    const nearCSkill = harness.repository.get(nearItems.find((item) => item.folderName === 'near-c')!.id);
    expect(nearASkill.duplicateKind).toBe('exact');
    expect(nearCSkill.duplicateKind).toBe('exact');
    expect(nearASkill.duplicateGroup).toBe(nearCSkill.duplicateGroup);
    expect(nearBSkill.duplicateKind).toBe('near');
    expect(nearBSkill.duplicateGroup).toMatch(/^near-/);
  });

  it('prunes snapshots, actions and analyses at write time within retention caps', async () => {
    const harness = await createHarness();
    const { sqlite } = harness.database;
    const now = new Date().toISOString();
    const snapshotInsert = sqlite.prepare(`
      INSERT INTO snapshots (id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at)
      VALUES (?, ?, 'SKILL.md', ?, ?, 'lf', 0, 'seed', ?)
    `);
    for (let index = 0; index < 25; index += 1) snapshotInsert.run(`snap-${index}`, harness.skillId, `c${index}`, `h${index}`, now);
    const actionInsert = sqlite.prepare(`
      INSERT INTO actions (id, skill_id, action, path, summary, metadata_json, created_at, reversible)
      VALUES (?, ?, 'edit_body', ?, 's', '{}', ?, 1)
    `);
    for (let index = 0; index < 6000; index += 1) actionInsert.run(`act-${index}`, harness.skillId, harness.skillPath, now);
    const analysisInsert = sqlite.prepare(`
      INSERT INTO ai_analyses (id, skill_id, provider_id, provider_name, model, protocol, content_hash,
        prompt_version, cache_key, payload_json, input_files_json, input_bytes, output_locale, created_at)
      VALUES (?, ?, 'p', 'Mock', 'm', 'chat_completions', 'h', 'v', ?, '{}', '[]', 0, 'zh-CN', ?)
    `);
    for (let index = 0; index < 12; index += 1) analysisInsert.run(`an-${index}`, harness.skillId, `ck-${index}`, now);

    // A real write path (updateBody → createSnapshot + insertAction) enforces
    // the snapshot and action caps; the analysis cap is enforced by AiService.
    const before = harness.repository.get(harness.skillId);
    await harness.operations.updateBody({ skillId: harness.skillId, body: '# Updated\n\nFresh body.', expectedHash: before.mainFileHash });

    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM snapshots').get()).toEqual({ count: 20 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM actions').get()).toEqual({ count: 5000 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ai_analyses').get()).toEqual({ count: 12 });
    pruneAnalyses(sqlite, harness.skillId);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ai_analyses').get()).toEqual({ count: 10 });
  });

  it('serves the Skill body from disk without storing a database copy', async () => {
    const harness = await createHarness();
    const before = harness.repository.get(harness.skillId);
    expect(before.body).toContain('# Demo');

    // The database no longer keeps the body: body_cache is empty after the scan.
    expect(harness.database.sqlite.prepare('SELECT body_cache FROM skills WHERE id = ?').get(harness.skillId)).toEqual({ body_cache: '' });

    // Editing the file on disk is reflected immediately, without rescanning.
    await fs.writeFile(path.join(harness.skillPath, 'SKILL.md'), '---\nname: demo-skill\ndescription: Scan and edit a test skill.\n---\n\n# Changed externally\n');
    expect(harness.repository.get(harness.skillId).body).toContain('# Changed externally');

    // A missing main file degrades to an empty body instead of throwing.
    await fs.rm(path.join(harness.skillPath, 'SKILL.md'), { force: true });
    expect(harness.repository.get(harness.skillId).body).toBe('');
  });

  it('uses snapshots, preserves CRLF/BOM, and blocks external-write conflicts', async () => {
    const harness = await createHarness(true);
    const before = harness.repository.get(harness.skillId);
    await harness.operations.updateBody({ skillId: harness.skillId, body: '# Updated\n\nNew body.', expectedHash: before.mainFileHash });
    const saved = await fs.readFile(path.join(harness.skillPath, 'SKILL.md'));
    expect(saved.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(saved.toString('utf8')).toContain('\r\n');
    expect(harness.operations.history().some((action) =>
      action.action === 'edit_body' && action.snapshotId && action.descriptor?.code === 'edit_body'
    )).toBe(true);

    const current = harness.repository.get(harness.skillId);
    await fs.appendFile(path.join(harness.skillPath, 'SKILL.md'), '\r\nExternal edit', 'utf8');
    await expect(harness.operations.updateBody({ skillId: harness.skillId, body: 'overwrite', expectedHash: current.mainFileHash })).rejects.toThrow(/外部修改/);
  });

  it('renames internal identity with preflight and updates known Codex self references', async () => {
    const harness = await createHarness();
    const before = harness.repository.get(harness.skillId);
    const preview = await harness.operations.previewRenameInternal({ skillId: harness.skillId, newName: 'renamed-skill', expectedHash: before.mainFileHash });
    expect(preview.targetPath).toBe(path.join(path.dirname(harness.skillPath), 'renamed-skill'));
    expect(preview.changes.some((change) => change.relativePath === 'agents/openai.yaml')).toBe(true);
    await harness.operations.renameInternal({ skillId: harness.skillId, newName: 'renamed-skill', expectedHash: before.mainFileHash });
    const renamed = harness.repository.get(harness.skillId);
    expect(renamed.name).toBe('renamed-skill');
    expect(renamed.path).toBe(preview.targetPath);
    expect(await fs.readFile(path.join(renamed.path, 'agents', 'openai.yaml'), 'utf8')).toContain('$renamed-skill');
  });

  it('moves user content to the workbench trash and restores it without purging history', async () => {
    const harness = await createHarness();
    const originalPath = harness.skillPath;
    await harness.operations.moveToTrash(harness.skillId);
    const trashed = harness.repository.get(harness.skillId);
    expect(trashed.state).toBe('trash');
    expect(await exists(originalPath)).toBe(false);
    expect(await exists(path.join(trashed.path, '.skill-workbench-trash.json'))).toBe(true);
    await harness.operations.restore(harness.skillId);
    const restored = harness.repository.get(harness.skillId);
    expect(restored.path).toBe(originalPath);
    expect(restored.state).toBe('active');
    expect(harness.operations.history().map((action) => action.action)).toEqual(expect.arrayContaining(['trash', 'restore']));
  });

  it('stores notes and validated images in the workbench database without touching the Skill directory', async () => {
    const harness = await createHarness();
    const skillFilesBefore = await fs.readdir(harness.skillPath, { recursive: true });
    const saved = harness.notes.save({ skillId: harness.skillId, body: '## 使用提示\n\n先检查输入。' });
    expect(saved.body).toContain('使用提示');

    const imagePath = path.join(harness.base, 'note.png');
    await fs.writeFile(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
    const image = await harness.notes.addImage(harness.skillId, imagePath);
    expect(image.mimeType).toBe('image/png');
    expect(image.url).toMatch(/^skill-note-image:\/\/[0-9a-f-]{36}$/);
    harness.notes.save({ skillId: harness.skillId, body: `${saved.body}\n\n![示例](skill-note-image:${image.id})` });
    const loaded = harness.notes.get(harness.skillId);
    expect(loaded.images).toHaveLength(1);
    expect(loaded.body).toContain(image.id);

    const rejectedPath = path.join(harness.base, 'fake.png');
    await fs.writeFile(rejectedPath, '<script>alert(1)</script>');
    await expect(harness.notes.addImage(harness.skillId, rejectedPath)).rejects.toThrow(/仅支持 PNG/);
    expect(await fs.readdir(harness.skillPath, { recursive: true })).toEqual(skillFilesBefore);

    const afterRemoval = harness.notes.removeImage(harness.skillId, image.id);
    expect(afterRemoval.images).toHaveLength(0);
    expect(afterRemoval.body).not.toContain(image.id);
  });

  it('serves note images over the custom protocol and enforces the per-Skill quota', async () => {
    const harness = await createHarness();
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const smallPath = path.join(harness.base, 'note-small.png');
    await fs.writeFile(smallPath, Buffer.concat([pngMagic, Buffer.from('payload')]));
    const image = await harness.notes.addImage(harness.skillId, smallPath);

    // The protocol resolves only UUID ids that exist in the database.
    const served = harness.notes.handleImageRequest(new Request(image.url));
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await served.arrayBuffer()).subarray(0, 8)).toEqual(pngMagic);
    expect(harness.notes.handleImageRequest(new Request('skill-note-image://00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect(harness.notes.handleImageRequest(new Request('skill-note-image://not-an-id')).status).toBe(404);

    // Two ~7.9 MB images fit; a third pushes past the 20 MB per-Skill quota.
    const bigPath = path.join(harness.base, 'note-big.png');
    const bigContent = Buffer.concat([pngMagic, Buffer.alloc(7.9 * 1024 * 1024 - pngMagic.length, 1)]);
    await fs.writeFile(bigPath, bigContent);
    await harness.notes.addImage(harness.skillId, bigPath);
    await harness.notes.addImage(harness.skillId, bigPath);
    await expect(harness.notes.addImage(harness.skillId, bigPath)).rejects.toThrow(/20 MB/);
    expect(harness.notes.get(harness.skillId).images).toHaveLength(3);
  });

  it('organizes a Skill only in the workbench index without moving or rewriting its source', async () => {
    const harness = await createHarness();
    const before = await fs.readFile(path.join(harness.skillPath, 'SKILL.md'));
    const beforeDetails = harness.repository.get(harness.skillId);
    harness.operations.updateOrganization({ skillId: harness.skillId, category: '视觉设计', tags: ['排版', '审计'] });
    const afterDetails = harness.repository.get(harness.skillId);
    expect(afterDetails.category).toBe('视觉设计');
    expect(afterDetails.tags).toEqual(['排版', '审计']);
    expect(afterDetails.path).toBe(beforeDetails.path);
    expect(await fs.readFile(path.join(harness.skillPath, 'SKILL.md'))).toEqual(before);
  });

  it.each(['chat_completions', 'responses'] as const)('accepts structured AI output over %s and caches by content hash', async (protocol) => {
    const harness = await createHarness();
    let calls = 0;
    const serverUrl = await startServer(async (_request, response) => {
      calls += 1;
      response.setHeader('content-type', 'application/json');
      const text = JSON.stringify(aiPayload());
      response.end(protocol === 'chat_completions'
        ? JSON.stringify({ choices: [{ message: { content: text } }] })
        : JSON.stringify({ output: [{ content: [{ type: 'output_text', text }] }] }));
    });
    const provider = fakeProvider(protocol, serverUrl);
    const ai = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => provider } as never);
    const skill = harness.repository.get(harness.skillId);
    const input = { skillId: skill.id, providerId: provider.id, attachments: ['references/guide.md'], expectedHash: skill.contentHash };
    const first = await ai.run(input);
    const second = await ai.run(input);
    expect(first.summary).toBe('结构清晰的测试 Skill。');
    expect(second.id).toBe(first.id);
    expect(calls).toBe(1);
    expect(first.outputLocale).toBe('zh-CN');
    expect(harness.database.sqlite.prepare('SELECT output_locale FROM ai_analyses WHERE id = ?').get(first.id)).toEqual({ output_locale: 'zh-CN' });
    expect(harness.operations.history().find((action) => action.action === 'ai_analyze')?.descriptor).toMatchObject({
      code: 'ai_analyze', params: { provider: 'Mock', model: 'mock-model', outputLocale: 'zh-CN' }
    });
  });

  it('isolates AI cache entries and latest results by output locale', async () => {
    const harness = await createHarness();
    let calls = 0;
    const prompts: string[] = [];
    const serverUrl = await startServer(async (request, response) => {
      calls += 1;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      prompts.push(Buffer.concat(chunks).toString('utf8'));
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiPayload()) } }] }));
    });
    const provider = fakeProvider('chat_completions', serverUrl);
    let locale: 'zh-CN' | 'en-US' = 'zh-CN';
    const repository = new SkillRepository(harness.database, () => locale);
    const ai = new AiService(harness.database, repository, harness.operations, { getRuntime: () => provider } as never, () => locale);
    const skill = repository.get(harness.skillId);
    const baseInput = { skillId: skill.id, providerId: provider.id, attachments: [], expectedHash: skill.contentHash };
    const zh = await ai.run({ ...baseInput, outputLocale: 'zh-CN' });
    locale = 'en-US';
    const en = await ai.run({ ...baseInput, outputLocale: 'en-US' });
    const enCached = await ai.run({ ...baseInput, outputLocale: 'en-US' });
    expect(zh.id).not.toBe(en.id);
    expect(enCached.id).toBe(en.id);
    expect(calls).toBe(2);
    expect(prompts[0]).toContain('所有自然语言分析字段使用简体中文');
    expect(prompts[1]).toContain('human-readable analysis fields in English');
    expect(repository.latestAnalysis(skill.id, skill.contentHash)?.outputLocale).toBe('en-US');
  });

  it('falls back from unsupported JSON Schema, validates JSON, redacts secrets, and supports cancellation', async () => {
    const harness = await createHarness();
    let fallbackCalls = 0;
    const fallbackUrl = await startServer(async (_request, response) => {
      fallbackCalls += 1;
      response.setHeader('content-type', 'application/json');
      if (fallbackCalls === 1) { response.statusCode = 400; response.end(JSON.stringify({ error: { message: 'response_format json_schema unsupported' } })); return; }
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiPayload()) } }] }));
    });
    const fallbackProvider = fakeProvider('chat_completions', fallbackUrl);
    const fallbackAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => fallbackProvider } as never);
    const skill = harness.repository.get(harness.skillId);
    await expect(fallbackAi.run({ skillId: skill.id, providerId: fallbackProvider.id, attachments: [], expectedHash: skill.contentHash })).resolves.toMatchObject({ confidence: 0.92 });
    expect(fallbackCalls).toBe(2);

    const secret = 'top-secret-key';
    const deniedUrl = await startServer(async (_request, response) => {
      response.statusCode = 401; response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: { message: `denied ${secret}` } }));
    });
    const deniedProvider = { ...fakeProvider('chat_completions', deniedUrl), id: crypto.randomUUID(), apiKey: secret };
    const deniedAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => deniedProvider } as never);
    await expect(deniedAi.run({ skillId: skill.id, providerId: deniedProvider.id, attachments: [], expectedHash: skill.contentHash })).rejects.not.toThrow(secret);

    const slowUrl = await startServer(async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!response.destroyed) response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiPayload()) } }] }));
    });
    const slowProvider = { ...fakeProvider('chat_completions', slowUrl), id: crypto.randomUUID() };
    const slowAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => slowProvider } as never);
    const pending = slowAi.run({ skillId: skill.id, providerId: slowProvider.id, attachments: [], expectedHash: skill.contentHash });
    await new Promise((resolve) => setTimeout(resolve, 40));
    slowAi.cancel(skill.id);
    await expect(pending).rejects.toThrow(/取消/);
  });

  it('surfaces rate limits, rejects invalid JSON, and times out stalled AI services', async () => {
    const harness = await createHarness();
    const skill = harness.repository.get(harness.skillId);
    const request = (provider: RuntimeProvider) => ({
      skillId: skill.id,
      providerId: provider.id,
      attachments: [],
      expectedHash: skill.contentHash
    });

    const limitedUrl = await startServer(async (_request, response) => {
      response.statusCode = 429;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: { message: 'rate limited' } }));
    });
    const limitedProvider = fakeProvider('chat_completions', limitedUrl);
    const limitedAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => limitedProvider } as never);
    await expect(limitedAi.run(request(limitedProvider))).rejects.toThrow(/HTTP 429.*rate limited/);

    const invalidUrl = await startServer(async (_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ choices: [{ message: { content: 'not valid json' } }] }));
    });
    const invalidProvider = { ...fakeProvider('chat_completions', invalidUrl), id: crypto.randomUUID() };
    const invalidAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => invalidProvider } as never);
    await expect(invalidAi.run(request(invalidProvider))).rejects.toThrow(/无效 JSON/);

    const timeoutUrl = await startServer(async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!response.destroyed) response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiPayload()) } }] }));
    });
    const timeoutProvider = { ...fakeProvider('chat_completions', timeoutUrl), id: crypto.randomUUID(), timeoutMs: 30 };
    const timeoutAi = new AiService(harness.database, harness.repository, harness.operations, { getRuntime: () => timeoutProvider } as never);
    await expect(timeoutAi.run(request(timeoutProvider))).rejects.toThrow(/请求超过/);
  });

  it('seeds a discovered TRAE root under its own host and indexes its skills there', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-trae-'));
    temporaryPaths.push(base);
    const home = path.join(base, 'home');
    const traeSkills = path.join(home, '.trae', 'skills');
    const skillPath = path.join(traeSkills, 'trae-demo');
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), '---\nname: trae-demo\ndescription: TRAE demo skill.\n---\n\nBody.\n');
    const userData = path.join(base, 'user-data');
    const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(home);
    try {
      const database = openDatabase(userData);
      const roots = new RootsService(database, userData);
      await roots.initializeDefaults();
      const traeRoot = roots.list().find((root) => root.host === 'trae');
      expect(traeRoot).toBeDefined();
      expect(traeRoot?.label).toBe('TRAE IDE Skills');
      const repository = new SkillRepository(database);
      const scanner = new ScannerService(database, repository);
      await scanner.scanAll();
      const result = repository.list({ state: 'active' });
      expect(result.stats.byHost.trae).toBe(1);
      expect(result.items.some((item) => item.host === 'trae' && item.folderName === 'trae-demo')).toBe(true);
      expect(result.stats.byHost.custom).toBeUndefined();
    } finally {
      homedirSpy.mockRestore();
      closeDatabase();
    }
  });

  it('reclassifies rows previously indexed under custom when the root host changes', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-trae-migrate-'));
    temporaryPaths.push(base);
    const home = path.join(base, 'home');
    const traeSkills = path.join(home, '.trae', 'skills');
    const skillPath = path.join(traeSkills, 'trae-demo');
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), '---\nname: trae-demo\ndescription: TRAE demo skill.\n---\n\nBody.\n');
    const userData = path.join(base, 'user-data');
    const database = openDatabase(userData);
    // Simulate the pre-fix state: the root and its skill are stored as custom.
    database.sqlite.prepare(`
      INSERT INTO roots (id, label, path, normalized_path, host, scope, source_type, writable,
        recursive, enabled, discovered, last_scanned_at, skill_count, created_at)
      VALUES ('trae-root', 'TRAE IDE Skills', ?, ?, 'custom', 'user', 'user', 1, 1, 1, 1, NULL, 0, ?)
    `).run(traeSkills, normalizeFsPath(traeSkills), new Date().toISOString());
    database.sqlite.prepare(`
      INSERT INTO skills (id, root_id, host, scope, source_type, state, path, normalized_path, real_path,
        folder_name, name, display_name, description, category, suggested_category, tags_json, writable,
        content_hash, main_file_hash, normalized_content_hash, search_text, frontmatter_json, body_cache,
        files_json, file_count, size_bytes, line_count, has_scripts, has_references, has_assets,
        has_agent_metadata, health, diagnostics_json, updated_at, indexed_at, scan_token)
      VALUES ('trae-skill', 'trae-root', 'custom', 'user', 'user', 'active', ?, ?, ?, 'trae-demo',
        'trae-demo', 'trae-demo', 'desc', '未分类', '未分类', '[]', 1, 'content-hash', 'main-hash',
        'norm-hash', 'search', '{}', '', '[]', 1, 10, 1, 0, 0, 0, 0, 'healthy', '[]',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'token')
    `).run(skillPath, normalizeFsPath(skillPath), skillPath);
    const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(home);
    try {
      const roots = new RootsService(database, userData);
      await roots.initializeDefaults();
      expect(roots.list().find((root) => root.id === 'trae-root')?.host).toBe('trae');
      const repository = new SkillRepository(database);
      const scanner = new ScannerService(database, repository);
      await scanner.scanAll();
      const result = repository.list({ state: 'active' });
      expect(result.stats.byHost.trae).toBe(1);
      expect(result.items.some((item) => item.host === 'trae')).toBe(true);
    } finally {
      homedirSpy.mockRestore();
      closeDatabase();
    }
  });
});

async function createHarness(bomAndCrlf = false): Promise<Harness> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-test-'));
  temporaryPaths.push(base);
  const project = path.join(base, 'project');
  const skillPath = path.join(project, '.agents', 'skills', 'demo-skill');
  await fs.mkdir(path.join(skillPath, 'agents'), { recursive: true });
  await fs.mkdir(path.join(skillPath, 'references'), { recursive: true });
  await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
  const text = `---\n# preserve me\nname: demo-skill\ndescription: Scan and edit a test skill.\ncustom-field: retained\n---\n\n# Demo\n\nRead [guide](references/guide.md) and invoke $demo-skill.\n`;
  const buffer = bomAndCrlf
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text.replace(/\n/g, '\r\n'))])
    : Buffer.from(text);
  await fs.writeFile(path.join(skillPath, 'SKILL.md'), buffer);
  await fs.writeFile(path.join(skillPath, 'agents', 'openai.yaml'), `interface:\n  display_name: 测试技能显示名\n  default_prompt: Use $demo-skill now.\n`);
  await fs.writeFile(path.join(skillPath, 'references', 'guide.md'), '# Safe guide');
  await fs.writeFile(path.join(skillPath, 'scripts', 'never-run.js'), `require('fs').writeFileSync(${JSON.stringify(path.join(base, 'script-ran.txt'))}, 'bad')`);
  const userData = path.join(base, 'user-data');
  const previous = process.env.SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS;
  process.env.SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS = '1';
  const database = openDatabase(userData);
  const roots = new RootsService(database, userData);
  await roots.initializeDefaults();
  await roots.add(project);
  if (previous === undefined) delete process.env.SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS;
  else process.env.SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS = previous;
  const repository = new SkillRepository(database);
  const scanner = new ScannerService(database, repository);
  await scanner.scanAll();
  const skill = repository.list({ state: 'active' }).items[0];
  if (!skill) throw new Error('Fixture skill was not indexed');
  const operations = new OperationsService(database, repository, scanner, path.join(userData, 'trash'));
  const notes = new NoteService(database);
  return { base, project, skillPath, database, repository, scanner, operations, notes, skillId: skill.id };
}

async function startServer(handler: (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void>): Promise<string> {
  const server = http.createServer((request, response) => void handler(request, response));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock server failed to listen');
  return `http://127.0.0.1:${address.port}`;
}

function fakeProvider(protocol: RuntimeProvider['protocol'], baseUrl: string): RuntimeProvider {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), name: 'Mock', protocol, baseUrl, model: 'mock-model', timeoutMs: 2000,
    headers: {}, hasApiKey: true, enabled: true, lastTestedAt: null, lastTestStatus: null,
    createdAt: now, updatedAt: now, apiKey: 'test-key', runtimeHeaders: {}
  };
}

function aiPayload() {
  return {
    summary: '结构清晰的测试 Skill。', capabilities: ['扫描测试'], recommendedCategory: '开发工程', tags: ['fixture'],
    triggerQuality: 'clear' as const, compatibilityNotes: ['兼容测试宿主'], riskFlags: [], improvementSuggestions: ['补充示例'], confidence: 0.92
  };
}

async function exists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}
