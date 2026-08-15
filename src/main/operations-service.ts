import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import type {
  ActionLog,
  ActionType,
  OperationResult,
  OrganizationInput,
  RenameInput,
  RenamePreview,
  SkillTextFile,
  UpdateBodyInput,
  UpdateMetadataInput,
  WriteTextInput
} from '../shared/types';
import type { DatabaseContext } from './db/database';
import type { SkillRow } from './db/schema';
import { pruneActions, pruneSnapshots } from './db/retention';
import { ScannerService } from './scanner-service';
import { parseSkillDocument, updateArbitraryFrontmatterField, updateSkillBody, updateSkillMetadata } from './skill-document';
import { SkillRepository } from './skill-repository';
import {
  assertSafeRelativePath,
  atomicWriteFile,
  createId,
  detectTextFormat,
  encodeText,
  errorMessage,
  isPathInside,
  localizeMessage,
  normalizeFsPath,
  nowIso,
  pathExists,
  safeJsonParse,
  sha256,
  toPosixPath,
  type MessageTranslator
} from './utils';

interface TrashManifest {
  version: 1;
  skillId: string;
  originalPath: string;
  rootId: string;
  host: string;
  scope: string;
  sourceType: string;
  writable: boolean;
  contentHash: string;
  trashedAt: string;
}

export class OperationsService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly repository: SkillRepository,
    private readonly scanner: ScannerService,
    private readonly trashPath: string,
    private readonly translate?: MessageTranslator
  ) {}

  async readText(skillId: string, relativePath: string): Promise<SkillTextFile> {
    const row = this.repository.getRow(skillId);
    const targetPath = await this.resolveSkillTextPath(row, relativePath, false);
    const buffer = await fs.readFile(targetPath);
    const format = detectTextFormat(buffer);
    const file = this.repository.get(skillId).files.find((entry) => entry.relativePath === toPosixPath(relativePath));
    return {
      skillId,
      relativePath: toPosixPath(relativePath),
      content: format.text,
      contentHash: sha256(buffer),
      language: languageFor(relativePath),
      editable: Boolean(row.writable && file?.editable),
      newline: format.newline,
      hasBom: format.hasBom
    };
  }

  async writeText(input: WriteTextInput): Promise<OperationResult> {
    const row = this.requireWritable(input.skillId);
    const file = this.repository.get(input.skillId).files.find((entry) => entry.relativePath === toPosixPath(input.relativePath));
    if (!file?.editable) throw new Error(this.message('error.textReadOnly', '该文本资源为只读或不在已索引文件中'));
    return this.writeExistingText(row, input.relativePath, input.content, input.expectedHash, 'edit_file', `编辑 ${input.relativePath}`);
  }

  async updateMetadata(input: UpdateMetadataInput): Promise<OperationResult> {
    const row = this.requireWritable(input.skillId);
    const current = await this.readText(input.skillId, 'SKILL.md');
    this.assertExpectedHash(current.contentHash, input.expectedHash);
    const parsed = parseSkillDocument(current.content);
    const updated = updateSkillMetadata(parsed, { name: input.name, description: input.description }, this.translate);
    return this.writeExistingText(row, 'SKILL.md', updated, input.expectedHash, 'edit_metadata', '修改结构化元数据');
  }

  async updateBody(input: UpdateBodyInput): Promise<OperationResult> {
    const row = this.requireWritable(input.skillId);
    const current = await this.readText(input.skillId, 'SKILL.md');
    this.assertExpectedHash(current.contentHash, input.expectedHash);
    const parsed = parseSkillDocument(current.content);
    const updated = updateSkillBody(parsed, input.body);
    return this.writeExistingText(row, 'SKILL.md', updated, input.expectedHash, 'edit_body', '修改 Markdown 正文');
  }

  updateOrganization(input: OrganizationInput): OperationResult {
    const row = this.repository.getRow(input.skillId);
    const before = { category: row.category, tags: JSON.parse(row.tagsJson) as string[] };
    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
    this.database.sqlite.transaction(() => {
      this.database.sqlite.prepare('UPDATE skills SET category = ?, tags_json = ? WHERE id = ?').run(input.category || '未分类', JSON.stringify(tags), input.skillId);
      this.insertAction({
        skillId: input.skillId,
        action: 'organize',
        path: row.path,
        summary: `分类为 ${input.category || '未分类'}`,
        beforeHash: row.contentHash,
        afterHash: row.contentHash,
        snapshotId: null,
        afterContent: null,
        relativePath: null,
        metadata: { before, after: { category: input.category || '未分类', tags } },
        reversible: false
      });
    })();
    return { ok: true, message: this.message('success.organizationSaved', '分类与标签已保存'), skillId: input.skillId };
  }

  async previewRenameDisplay(input: RenameInput): Promise<RenamePreview> {
    const row = this.requireWritable(input.skillId);
    await this.assertMainHash(row, input.expectedHash);
    const changes: RenamePreview['changes'] = [];
    const warnings: string[] = [];
    if (row.host === 'codex') {
      const relativePath = 'agents/openai.yaml';
      const target = path.join(row.path, ...relativePath.split('/'));
      const before = await fs.readFile(target, 'utf8').catch(() => '');
      changes.push({ relativePath, before, after: updateOpenAiDisplayName(before, input.newName, this.translate) });
    } else if (row.host === 'workbuddy') {
      const main = await this.readText(row.id, 'SKILL.md');
      changes.push({
        relativePath: 'SKILL.md',
        before: main.content,
        after: updateArbitraryFrontmatterField(parseSkillDocument(main.content), 'title', input.newName, this.translate)
      });
    } else {
      warnings.push(this.message('warning.aliasOnly', '该宿主没有独立显示名字段；此名称只保存在工作台索引中，不修改 Skill 文件。'));
    }
    return {
      skillId: row.id,
      mode: 'display',
      oldValue: row.displayName,
      newValue: input.newName,
      targetPath: null,
      changes,
      warnings
    };
  }

  async renameDisplay(input: RenameInput): Promise<OperationResult> {
    const row = this.requireWritable(input.skillId);
    const preview = await this.previewRenameDisplay(input);
    let snapshotId: string | null = null;
    if (preview.changes.length > 0) {
      const change = preview.changes[0];
      if (!change) throw new Error(this.message('error.displayPreviewEmpty', '显示名预览为空'));
      const relative = change.relativePath;
      const target = path.join(row.path, ...relative.split('/'));
      await fs.mkdir(path.dirname(target), { recursive: true });
      const exists = await pathExists(target);
      let newline: 'lf' | 'crlf' = 'lf';
      let hasBom = false;
      if (exists) {
        const buffer = await fs.readFile(target);
        const format = detectTextFormat(buffer);
        newline = format.newline;
        hasBom = format.hasBom;
        snapshotId = this.createSnapshot(row.id, relative, format.text, format.newline, format.hasBom, '修改显示名');
      }
      await atomicWriteFile(target, encodeText(change.after, newline, hasBom));
    } else {
      this.database.sqlite.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(`display:${normalizeFsPath(row.path)}`, input.newName, nowIso());
    }
    const actionId = this.insertAction({
      skillId: row.id, action: 'rename_display', path: row.path, summary: `显示名：${row.displayName} → ${input.newName}`,
      beforeHash: row.mainFileHash, afterHash: null, snapshotId, afterContent: preview.changes[0]?.after ?? null,
      relativePath: preview.changes[0]?.relativePath ?? null, metadata: { oldValue: row.displayName, newValue: input.newName }, reversible: Boolean(snapshotId)
    });
    await this.scanner.rescanSkill(row.id);
    return { ok: true, message: this.message('success.displayRenamed', '显示名已修改'), skillId: row.id, actionId };
  }

  async previewRenameInternal(input: RenameInput): Promise<RenamePreview> {
    const row = this.requireWritable(input.skillId);
    await this.assertMainHash(row, input.expectedHash);
    const targetPath = path.join(path.dirname(row.path), input.newName);
    if (normalizeFsPath(targetPath) !== normalizeFsPath(row.path) && await pathExists(targetPath)) {
      throw new Error(this.message('error.targetExists', `目标目录已存在：${targetPath}`, { path: targetPath }));
    }
    const main = await this.readText(row.id, 'SKILL.md');
    let updatedMain = updateSkillMetadata(parseSkillDocument(main.content), { name: input.newName }, this.translate);
    updatedMain = replaceKnownSelfReferences(updatedMain, row.name, input.newName);
    const changes: RenamePreview['changes'] = [{ relativePath: 'SKILL.md', before: main.content, after: updatedMain }];
    const metadataPath = path.join(row.path, 'agents', 'openai.yaml');
    if (await pathExists(metadataPath)) {
      const before = await fs.readFile(metadataPath, 'utf8');
      const after = updateOpenAiSelfReferences(before, row.name, input.newName, this.translate);
      if (after !== before) changes.push({ relativePath: 'agents/openai.yaml', before, after });
    }
    const warnings: string[] = [];
    if (row.host === 'claude') warnings.push(this.message('warning.claudeRename', 'Claude 的斜杠命令通常由目录名决定，本操作会同步重命名目录。'));
    if (changes.some((change) => change.after.includes(row.name))) warnings.push(this.message('warning.oldNameText', '仍有旧名称文本，请在差异中确认是否属于普通说明。'));
    return { skillId: row.id, mode: 'internal', oldValue: row.name, newValue: input.newName, targetPath, changes, warnings };
  }

  async renameInternal(input: RenameInput): Promise<OperationResult> {
    const row = this.requireWritable(input.skillId);
    const preview = await this.previewRenameInternal(input);
    if (!preview.targetPath) throw new Error(this.message('error.targetMissing', '缺少目标目录'));
    const targetPath = preview.targetPath;
    const snapshots: Array<{ relativePath: string; content: string; newline: 'lf' | 'crlf'; hasBom: boolean; id: string }> = [];
    for (const change of preview.changes) {
      const target = path.join(row.path, ...change.relativePath.split('/'));
      const buffer = await fs.readFile(target);
      const format = detectTextFormat(buffer);
      snapshots.push({
        relativePath: change.relativePath,
        content: format.text,
        newline: format.newline,
        hasBom: format.hasBom,
        id: this.createSnapshot(row.id, change.relativePath, format.text, format.newline, format.hasBom, '修改内部名称')
      });
    }
    let renamed = false;
    try {
      for (const change of preview.changes) {
        const snapshot = snapshots.find((item) => item.relativePath === change.relativePath);
        if (!snapshot) continue;
        await atomicWriteFile(path.join(row.path, ...change.relativePath.split('/')), encodeText(change.after, snapshot.newline, snapshot.hasBom));
      }
      await renameDirectorySafely(row.path, targetPath);
      renamed = true;
      const oldSettingsKey = `display:${normalizeFsPath(row.path)}`;
      const newSettingsKey = `display:${normalizeFsPath(targetPath)}`;
      this.database.sqlite.transaction(() => {
        this.database.sqlite.prepare(`
          UPDATE skills SET path = ?, normalized_path = ?, real_path = ?, folder_name = ?, name = ? WHERE id = ?
        `).run(targetPath, normalizeFsPath(targetPath), targetPath, path.basename(targetPath), input.newName, row.id);
        this.database.sqlite.prepare('UPDATE settings SET key = ? WHERE key = ?').run(newSettingsKey, oldSettingsKey);
      })();
    } catch (error) {
      if (renamed) await renameDirectorySafely(targetPath, row.path).catch(() => undefined);
      const activePath = row.path;
      for (const snapshot of snapshots) {
        await atomicWriteFile(path.join(activePath, ...snapshot.relativePath.split('/')), encodeText(snapshot.content, snapshot.newline, snapshot.hasBom)).catch(() => undefined);
      }
      const detail = errorMessage(error);
      throw new Error(this.message('error.renameRollback', `内部改名失败并已尝试回滚：${detail}`, { error: detail }));
    }
    const actionId = this.insertAction({
      skillId: row.id, action: 'rename_internal', path: targetPath, summary: `内部名称：${row.name} → ${input.newName}`,
      beforeHash: row.mainFileHash, afterHash: null, snapshotId: snapshots[0]?.id ?? null,
      afterContent: preview.changes[0]?.after ?? null, relativePath: 'SKILL.md',
      metadata: { oldPath: row.path, newPath: targetPath, oldName: row.name, newName: input.newName }, reversible: false
    });
    await this.scanner.rescanSkill(row.id);
    return { ok: true, message: this.message('success.internalRenamed', '内部名称与目录已修改'), skillId: row.id, actionId };
  }

  async moveToTrash(skillId: string): Promise<OperationResult> {
    const row = this.requireWritable(skillId);
    if (!['user', 'project'].includes(row.sourceType)) throw new Error(this.message('error.trashSourceOnly', '只有用户和项目来源可以移入工作台回收站'));
    await fs.mkdir(this.trashPath, { recursive: true });
    if (!isPathInside(this.trashPath, path.join(this.trashPath, `${row.id}--${row.folderName}`))) throw new Error(this.message('error.trashTargetInvalid', '回收站目标路径无效'));
    const destination = path.join(this.trashPath, `${row.id}--${safeFileName(row.folderName)}`);
    if (await pathExists(destination)) throw new Error(this.message('error.trashConflict', '回收站中已存在同一 Skill，请先恢复或处理冲突'));
    const manifest: TrashManifest = {
      version: 1, skillId: row.id, originalPath: row.path, rootId: row.rootId, host: row.host,
      scope: row.scope, sourceType: row.sourceType, writable: row.writable, contentHash: row.contentHash, trashedAt: nowIso()
    };
    await fs.writeFile(path.join(row.path, '.skill-workbench-trash.json'), JSON.stringify(manifest, null, 2), 'utf8');
    try {
      await moveDirectoryVerified(row.path, destination, this.translate);
    } catch (error) {
      await fs.rm(path.join(row.path, '.skill-workbench-trash.json'), { force: true }).catch(() => undefined);
      throw error;
    }
    const trashRoot = this.database.sqlite.prepare("SELECT id FROM roots WHERE source_type = 'trash' LIMIT 1").get() as { id: string } | undefined;
    if (!trashRoot) throw new Error(this.message('error.trashRootMissing', '工作台回收站根目录未初始化'));
    this.database.sqlite.prepare(`
      UPDATE skills SET root_id = ?, path = ?, normalized_path = ?, real_path = ?, original_path = ?,
        source_type = 'trash', scope = 'system', state = 'trash', writable = 0 WHERE id = ?
    `).run(trashRoot.id, destination, normalizeFsPath(destination), destination, row.path, row.id);
    const actionId = this.insertAction({
      skillId: row.id, action: 'trash', path: destination, summary: `移入回收站：${row.displayName}`,
      beforeHash: row.contentHash, afterHash: row.contentHash, snapshotId: null, afterContent: null,
      relativePath: null, metadata: { ...manifest, displayName: row.displayName }, reversible: true
    });
    await this.scanner.rescanSkill(row.id);
    return { ok: true, message: this.message('success.movedTrash', '已移入工作台回收站，可随时恢复'), skillId: row.id, actionId };
  }

  async restore(skillId: string): Promise<OperationResult> {
    const row = this.repository.getRow(skillId);
    if (row.state !== 'trash' || row.sourceType !== 'trash') throw new Error(this.message('error.notInTrash', '该 Skill 不在工作台回收站中'));
    const manifestPath = path.join(row.path, '.skill-workbench-trash.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as TrashManifest;
    if (manifest.skillId !== skillId || !manifest.originalPath) throw new Error(this.message('error.trashManifestInvalid', '回收站清单无效'));
    if (await pathExists(manifest.originalPath)) throw new Error(this.message('error.originalOccupied', `原位置已被占用：${manifest.originalPath}`, { path: manifest.originalPath }));
    const rootExists = this.database.sqlite.prepare('SELECT id FROM roots WHERE id = ?').get(manifest.rootId) as { id: string } | undefined;
    if (!rootExists) throw new Error(this.message('error.originalRootMissing', '原 Skill 根目录配置已移除，请重新添加项目根后再恢复'));
    await fs.mkdir(path.dirname(manifest.originalPath), { recursive: true });
    await moveDirectoryVerified(row.path, manifest.originalPath, this.translate);
    await fs.rm(path.join(manifest.originalPath, '.skill-workbench-trash.json'), { force: true });
    this.database.sqlite.prepare(`
      UPDATE skills SET root_id = ?, path = ?, normalized_path = ?, real_path = ?, original_path = NULL,
        host = ?, scope = ?, source_type = ?, state = 'active', writable = ? WHERE id = ?
    `).run(manifest.rootId, manifest.originalPath, normalizeFsPath(manifest.originalPath), manifest.originalPath,
      manifest.host, manifest.scope, manifest.sourceType, Number(manifest.writable), row.id);
    const actionId = this.insertAction({
      skillId: row.id, action: 'restore', path: manifest.originalPath, summary: `恢复：${row.displayName}`,
      beforeHash: row.contentHash, afterHash: row.contentHash, snapshotId: null, afterContent: null,
      relativePath: null, metadata: { ...manifest, displayName: row.displayName }, reversible: false
    });
    await this.scanner.rescanSkill(row.id);
    return { ok: true, message: this.message('success.restored', '已恢复到原位置'), skillId: row.id, actionId };
  }

  history(limit = 100): ActionLog[] {
    const rows = this.database.sqlite.prepare(`
      SELECT a.*,
        aa.provider_name AS analysis_provider_name,
        aa.model AS analysis_model,
        aa.output_locale AS analysis_output_locale
      FROM actions a
      LEFT JOIN ai_analyses aa ON aa.id = CASE
        WHEN json_valid(a.metadata_json) THEN json_extract(a.metadata_json, '$.analysisId')
        ELSE NULL
      END
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(Math.min(Math.max(limit, 1), 1000)) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const action = row.action as ActionType;
      const storedMetadata = safeJsonParse<unknown>(row.metadata_json ? String(row.metadata_json) : null, {});
      const metadata = action === 'ai_analyze'
        ? {
            ...objectValue(storedMetadata),
            providerName: stringValue(objectValue(storedMetadata).providerName) || stringValue(row.analysis_provider_name),
            model: stringValue(objectValue(storedMetadata).model) || stringValue(row.analysis_model),
            outputLocale: stringValue(objectValue(storedMetadata).outputLocale) || stringValue(row.analysis_output_locale)
          }
        : storedMetadata;
      return {
        id: String(row.id), skillId: row.skill_id ? String(row.skill_id) : null, action,
        path: String(row.path), summary: String(row.summary), beforeHash: row.before_hash ? String(row.before_hash) : null,
        afterHash: row.after_hash ? String(row.after_hash) : null, snapshotId: row.snapshot_id ? String(row.snapshot_id) : null,
        createdAt: String(row.created_at), reversible: Boolean(row.reversible),
        descriptor: buildActionDescriptor(action, metadata, row.relative_path ? String(row.relative_path) : null)
      };
    });
  }

  showDiff(actionId: string): { before: string; after: string; relativePath: string } {
    const row = this.database.sqlite.prepare(`
      SELECT a.relative_path, a.after_content, s.content AS before_content
      FROM actions a LEFT JOIN snapshots s ON s.id = a.snapshot_id WHERE a.id = ?
    `).get(actionId) as { relative_path: string | null; after_content: string | null; before_content: string | null } | undefined;
    if (!row) throw new Error(this.message('error.historyMissing', '历史记录不存在'));
    return { before: row.before_content ?? '', after: row.after_content ?? '', relativePath: row.relative_path ?? '' };
  }

  async restoreSnapshot(snapshotId: string): Promise<OperationResult> {
    const snapshot = this.database.sqlite.prepare('SELECT * FROM snapshots WHERE id = ?').get(snapshotId) as Record<string, unknown> | undefined;
    if (!snapshot) throw new Error(this.message('error.snapshotMissing', '快照不存在'));
    const skillId = String(snapshot.skill_id);
    const row = this.requireWritable(skillId);
    const relativePath = String(snapshot.relative_path);
    const current = await this.readText(skillId, relativePath);
    const result = await this.writeExistingText(
      row,
      relativePath,
      String(snapshot.content),
      current.contentHash,
      'restore_snapshot',
      `恢复快照 ${new Date(String(snapshot.created_at)).toLocaleString('zh-CN')}`
    );
    return result;
  }

  private async writeExistingText(
    row: SkillRow,
    relativePath: string,
    newText: string,
    expectedHash: string,
    action: ActionType,
    summary: string
  ): Promise<OperationResult> {
    const targetPath = await this.resolveSkillTextPath(row, relativePath, true);
    const currentBuffer = await fs.readFile(targetPath);
    const currentHash = sha256(currentBuffer);
    this.assertExpectedHash(currentHash, expectedHash);
    const format = detectTextFormat(currentBuffer);
    const snapshotId = this.createSnapshot(row.id, relativePath, format.text, format.newline, format.hasBom, summary);
    const encoded = encodeText(newText, format.newline, format.hasBom);
    await atomicWriteFile(targetPath, encoded);
    const afterHash = sha256(encoded);
    const actionId = this.insertAction({
      skillId: row.id, action, path: row.path, relativePath, summary, beforeHash: currentHash,
      afterHash, snapshotId, afterContent: newText, metadata: {}, reversible: true
    });
    await this.scanner.rescanSkill(row.id);
    return { ok: true, message: this.message('success.saved', '保存成功'), skillId: row.id, actionId };
  }

  private requireWritable(skillId: string): SkillRow {
    const row = this.repository.getRow(skillId);
    if (!row.writable || !['user', 'project'].includes(row.sourceType)) throw new Error(this.message('error.sourceReadOnly', '该来源为只读，不能修改文件'));
    return row;
  }

  private async resolveSkillTextPath(row: SkillRow, relativePath: string, forWrite: boolean): Promise<string> {
    assertSafeRelativePath(relativePath, this.translate);
    const target = path.resolve(row.path, ...relativePath.replace(/\\/g, '/').split('/'));
    if (!isPathInside(row.path, target)) throw new Error(this.message('error.pathEscapesSkill', '文件路径越过了 Skill 目录'));
    const stat = await fs.stat(target).catch(() => null);
    if (!stat?.isFile()) throw new Error(this.message('error.textMissing', '文本资源不存在'));
    const real = await fs.realpath(target);
    if (!isPathInside(row.realPath, real)) throw new Error(this.message('error.symlinkOutside', '符号链接指向 Skill 目录之外'));
    if (forWrite && !row.writable) throw new Error(this.message('error.skillReadOnly', '该 Skill 为只读'));
    return target;
  }

  private async assertMainHash(row: SkillRow, expectedHash: string): Promise<void> {
    const buffer = await fs.readFile(path.join(row.path, 'SKILL.md'));
    this.assertExpectedHash(sha256(buffer), expectedHash);
  }

  private assertExpectedHash(actual: string, expected: string): void {
    if (actual !== expected) throw new Error(this.message('error.externalModified', '文件已被外部修改，已阻止覆盖。请刷新后比较冲突内容。'));
  }

  private createSnapshot(
    skillId: string,
    relativePath: string,
    content: string,
    newline: 'lf' | 'crlf',
    hasBom: boolean,
    reason: string
  ): string {
    const id = createId();
    this.database.sqlite.prepare(`
      INSERT INTO snapshots (id, skill_id, relative_path, content, content_hash, newline, has_bom, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, skillId, relativePath, content, sha256(content), newline, Number(hasBom), reason, nowIso());
    pruneSnapshots(this.database.sqlite, skillId);
    return id;
  }

  private insertAction(input: {
    skillId: string | null;
    action: ActionType;
    path: string;
    relativePath: string | null;
    summary: string;
    beforeHash: string | null;
    afterHash: string | null;
    afterContent: string | null;
    snapshotId: string | null;
    metadata: unknown;
    reversible: boolean;
  }): string {
    const id = createId();
    this.database.sqlite.prepare(`
      INSERT INTO actions (
        id, skill_id, action, path, relative_path, summary, before_hash, after_hash,
        after_content, snapshot_id, metadata_json, created_at, reversible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.skillId, input.action, input.path, input.relativePath, input.summary, input.beforeHash,
      input.afterHash, input.afterContent, input.snapshotId, JSON.stringify(input.metadata), nowIso(), Number(input.reversible));
    pruneActions(this.database.sqlite);
    return id;
  }

  private message(key: string, fallback: string, params?: Record<string, string | number>): string {
    return localizeMessage(this.translate, key, fallback, params);
  }
}

export function buildActionDescriptor(
  action: ActionType,
  metadata: unknown,
  relativePath: string | null = null
): NonNullable<ActionLog['descriptor']> {
  const record = objectValue(metadata);
  const descriptor = (params?: Record<string, string | number>): NonNullable<ActionLog['descriptor']> => ({
    code: action,
    ...(params && Object.keys(params).length > 0 ? { params } : {})
  });
  switch (action) {
    case 'edit_file':
      return descriptor(optionalParams({ path: stringValue(record.relativePath) || relativePath || '' }));
    case 'edit_metadata':
    case 'edit_body':
      return descriptor();
    case 'rename_display':
      return descriptor(optionalParams({
        before: stringValue(record.oldValue),
        after: stringValue(record.newValue)
      }));
    case 'rename_internal':
      return descriptor(optionalParams({
        before: stringValue(record.oldName),
        after: stringValue(record.newName)
      }));
    case 'trash':
    case 'restore': {
      const originalPath = stringValue(record.originalPath);
      return descriptor(optionalParams({
        name: stringValue(record.displayName) || (originalPath ? path.basename(originalPath) : '')
      }));
    }
    case 'restore_snapshot':
      return descriptor(optionalParams({
        path: stringValue(record.relativePath) || relativePath || '',
        snapshotCreatedAt: stringValue(record.snapshotCreatedAt)
      }));
    case 'organize': {
      const after = objectValue(record.after);
      const tags = Array.isArray(after.tags) ? after.tags : [];
      return descriptor(optionalParams({ category: stringValue(after.category), tagCount: tags.length }));
    }
    case 'ai_analyze':
      return descriptor(optionalParams({
        provider: stringValue(record.providerName),
        model: stringValue(record.model),
        outputLocale: stringValue(record.outputLocale)
      }));
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalParams(values: Record<string, string | number>): Record<string, string | number> | undefined {
  const entries = Object.entries(values).filter(([, value]) => typeof value === 'number' || value.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function languageFor(relativePath: string): SkillTextFile['language'] {
  const extension = path.extname(relativePath).toLocaleLowerCase('en-US');
  if (extension === '.md' || extension === '.mdx') return 'markdown';
  if (extension === '.yaml' || extension === '.yml') return 'yaml';
  if (extension === '.json') return 'json';
  if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.ps1', '.sh'].includes(extension)) return 'code';
  return 'text';
}

function updateOpenAiDisplayName(raw: string, displayName: string, translate?: MessageTranslator): string {
  const document = parseDocument(raw || '{}', { keepSourceTokens: true, prettyErrors: true, strict: false });
  if (document.errors.length > 0) {
    const error = document.errors[0]?.message ?? '';
    throw new Error(localizeMessage(translate, 'error.metadataYamlInvalid', `agents/openai.yaml 无法解析：${error}`, { error }));
  }
  if (!document.get('interface')) document.set('interface', {});
  document.setIn(['interface', 'display_name'], displayName);
  return document.toString({ lineWidth: 0 });
}

function updateOpenAiSelfReferences(raw: string, oldName: string, newName: string, translate?: MessageTranslator): string {
  const document = parseDocument(raw, { keepSourceTokens: true, prettyErrors: true, strict: false });
  if (document.errors.length > 0) {
    const error = document.errors[0]?.message ?? '';
    throw new Error(localizeMessage(translate, 'error.metadataYamlInvalid', `agents/openai.yaml 无法解析：${error}`, { error }));
  }
  const prompt = document.getIn(['interface', 'default_prompt']);
  if (typeof prompt === 'string') document.setIn(['interface', 'default_prompt'], replaceInvocationReferences(prompt, oldName, newName));
  return document.toString({ lineWidth: 0 });
}

function replaceKnownSelfReferences(content: string, oldName: string, newName: string): string {
  const parsed = parseSkillDocument(content);
  const updatedBody = replaceInvocationReferences(parsed.body, oldName, newName);
  return updateSkillBody(parsed, updatedBody);
}

function replaceInvocationReferences(value: string, oldName: string, newName: string): string {
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`([$/])${escaped}(?=\\b|\\s|$)`, 'g'), `$1${newName}`);
}

async function renameDirectorySafely(source: string, target: string): Promise<void> {
  if (source === target) return;
  if (normalizeFsPath(source) === normalizeFsPath(target)) {
    const intermediate = path.join(path.dirname(source), `.skill-workbench-rename-${createId()}`);
    await fs.rename(source, intermediate);
    try {
      await fs.rename(intermediate, target);
    } catch (error) {
      await fs.rename(intermediate, source).catch(() => undefined);
      throw error;
    }
    return;
  }
  await fs.rename(source, target);
}

async function moveDirectoryVerified(source: string, destination: string, translate?: MessageTranslator): Promise<void> {
  const sourceResolved = path.resolve(source);
  const destinationResolved = path.resolve(destination);
  if (sourceResolved === path.parse(sourceResolved).root || destinationResolved === path.parse(destinationResolved).root) {
    throw new Error(localizeMessage(translate, 'error.diskRootMove', '拒绝对磁盘根目录执行移动'));
  }
  try {
    await fs.rename(sourceResolved, destinationResolved);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
  }
  await fs.cp(sourceResolved, destinationResolved, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  const [sourceHash, destinationHash] = await Promise.all([hashDirectory(sourceResolved), hashDirectory(destinationResolved)]);
  if (sourceHash !== destinationHash) {
    await fs.rm(destinationResolved, { recursive: true, force: true });
    throw new Error(localizeMessage(translate, 'error.crossDiskVerify', '跨盘复制校验失败，原目录保持不变'));
  }
  await fs.rm(sourceResolved, { recursive: true, force: true });
}

async function hashDirectory(directory: string): Promise<string> {
  const entries: string[] = [];
  const queue = [''];
  while (queue.length > 0) {
    const relativeDirectory = queue.shift() ?? '';
    const children = await fs.readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
    for (const child of children) {
      const relative = path.join(relativeDirectory, child.name);
      if (child.isDirectory()) queue.push(relative);
      else if (child.isFile()) entries.push(relative);
      else if (child.isSymbolicLink()) entries.push(relative);
    }
  }
  entries.sort();
  const hashes: string[] = [];
  for (const relative of entries) {
    const target = path.join(directory, relative);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) hashes.push(`${toPosixPath(relative)}:link:${await fs.readlink(target)}`);
    else hashes.push(`${toPosixPath(relative)}:${sha256(await fs.readFile(target))}`);
  }
  return sha256(hashes.join('\n'));
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'skill';
}
