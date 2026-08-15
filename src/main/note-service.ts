import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SaveSkillNoteInput, SkillNote, SkillNoteImage } from '../shared/types';
import type { DatabaseContext } from './db/database';
import { createId, localizeMessage, nowIso, type MessageTranslator } from './utils';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Total note-image budget per Skill (optimization plan #9). */
const IMAGE_QUOTA_PER_SKILL = 20 * 1024 * 1024;
/** UUID-shaped ids only; the protocol never resolves anything else. */
const IMAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NoteRow {
  body: string;
  updated_at: string;
}

interface ImageRow {
  id: string;
  skill_id: string;
  filename: string;
  mime_type: SkillNoteImage['mimeType'];
  content: Buffer;
  size_bytes: number;
  created_at: string;
}

export class NoteService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly translate?: MessageTranslator
  ) {}

  get(skillId: string): SkillNote {
    this.requireSkill(skillId);
    const note = this.database.sqlite.prepare('SELECT body, updated_at FROM skill_notes WHERE skill_id = ?').get(skillId) as NoteRow | undefined;
    const images = this.database.sqlite.prepare('SELECT * FROM skill_note_images WHERE skill_id = ? ORDER BY created_at').all(skillId) as ImageRow[];
    return {
      skillId,
      body: note?.body ?? '',
      updatedAt: note?.updated_at ?? null,
      images: images.map(mapImage)
    };
  }

  save(input: SaveSkillNoteInput): SkillNote {
    this.requireSkill(input.skillId);
    const updatedAt = nowIso();
    this.database.sqlite.prepare(`
      INSERT INTO skill_notes (skill_id, body, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(skill_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at
    `).run(input.skillId, input.body, updatedAt);
    return this.get(input.skillId);
  }

  async addImage(skillId: string, filePath: string): Promise<SkillNoteImage> {
    this.requireSkill(skillId);
    const content = await fs.readFile(filePath);
    if (content.length === 0) throw new Error(localizeMessage(this.translate, 'error.noteImageEmpty', '图片文件为空'));
    if (content.length > MAX_IMAGE_BYTES) throw new Error(localizeMessage(this.translate, 'error.noteImageTooLarge', '单张备注图片不能超过 8 MB'));
    const mimeType = detectRasterImage(content);
    if (!mimeType) throw new Error(localizeMessage(this.translate, 'error.noteImageType', '仅支持 PNG、JPEG、GIF 或 WebP 图片'));
    const total = this.database.sqlite.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM skill_note_images WHERE skill_id = ?').get(skillId) as { total: number };
    if ((total.total ?? 0) + content.length > IMAGE_QUOTA_PER_SKILL) {
      throw new Error(localizeMessage(this.translate, 'error.noteImageQuota', '单 Skill 备注图片总量不能超过 20 MB'));
    }
    const id = createId();
    const createdAt = nowIso();
    const filename = path.basename(filePath).slice(0, 240);
    this.database.sqlite.prepare(`
      INSERT INTO skill_note_images (id, skill_id, filename, mime_type, content, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, skillId, filename, mimeType, content, content.length, createdAt);
    return { id, skillId, filename, mimeType, sizeBytes: content.length, url: toImageUrl(id), createdAt };
  }

  /**
   * Serves one note image over the custom `skill-note-image` scheme, keyed by
   * its UUID — the same boundary the IPC layer enforces: only ids that exist
   * in the database are ever resolvable, and the id must be UUID-shaped.
   */
  handleImageRequest(request: Request): Response {
    let id = '';
    try {
      id = new URL(request.url).hostname;
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (!IMAGE_ID_PATTERN.test(id)) return new Response('Not found', { status: 404 });
    const row = this.database.sqlite.prepare('SELECT content, mime_type FROM skill_note_images WHERE id = ?').get(id) as { content: Buffer; mime_type: string } | undefined;
    if (!row) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(Buffer.from(row.content)), {
      status: 200,
      headers: { 'content-type': row.mime_type, 'cache-control': 'no-store' }
    });
  }

  removeImage(skillId: string, imageId: string): SkillNote {
    this.requireSkill(skillId);
    this.database.sqlite.transaction(() => {
      const result = this.database.sqlite.prepare('DELETE FROM skill_note_images WHERE id = ? AND skill_id = ?').run(imageId, skillId);
      if (result.changes === 0) throw new Error(localizeMessage(this.translate, 'error.noteImageMissing', '备注图片不存在'));
      const row = this.database.sqlite.prepare('SELECT body FROM skill_notes WHERE skill_id = ?').get(skillId) as { body: string } | undefined;
      if (row) {
        const marker = `skill-note-image:${imageId}`;
        const body = row.body.replaceAll(marker, '');
        this.database.sqlite.prepare('UPDATE skill_notes SET body = ?, updated_at = ? WHERE skill_id = ?').run(body, nowIso(), skillId);
      }
    })();
    return this.get(skillId);
  }

  private requireSkill(skillId: string): void {
    const exists = this.database.sqlite.prepare('SELECT 1 FROM skills WHERE id = ?').get(skillId);
    if (!exists) throw new Error(localizeMessage(this.translate, 'error.skillNotIndexed', 'Skill 不存在或尚未建立索引'));
  }
}

function toImageUrl(id: string): string {
  return `skill-note-image://${id}`;
}

function mapImage(row: ImageRow): SkillNoteImage {
  return {
    id: row.id,
    skillId: row.skill_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    url: toImageUrl(row.id),
    createdAt: row.created_at
  };
}

function detectRasterImage(content: Buffer): SkillNoteImage['mimeType'] | null {
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'image/jpeg';
  if (content.length >= 6 && (content.subarray(0, 6).toString('ascii') === 'GIF87a' || content.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  if (content.length >= 12 && content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
