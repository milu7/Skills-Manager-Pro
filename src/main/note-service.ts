import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SaveSkillNoteInput, SkillNote, SkillNoteImage } from '../shared/types';
import type { DatabaseContext } from './db/database';
import { createId, nowIso } from './utils';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  constructor(private readonly database: DatabaseContext) {}

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
    if (content.length === 0) throw new Error('图片文件为空');
    if (content.length > MAX_IMAGE_BYTES) throw new Error('单张备注图片不能超过 8 MB');
    const mimeType = detectRasterImage(content);
    if (!mimeType) throw new Error('仅支持 PNG、JPEG、GIF 或 WebP 图片');
    const id = createId();
    const createdAt = nowIso();
    const filename = path.basename(filePath).slice(0, 240);
    this.database.sqlite.prepare(`
      INSERT INTO skill_note_images (id, skill_id, filename, mime_type, content, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, skillId, filename, mimeType, content, content.length, createdAt);
    return { id, skillId, filename, mimeType, sizeBytes: content.length, dataUrl: toDataUrl(mimeType, content), createdAt };
  }

  removeImage(skillId: string, imageId: string): SkillNote {
    this.requireSkill(skillId);
    this.database.sqlite.transaction(() => {
      const result = this.database.sqlite.prepare('DELETE FROM skill_note_images WHERE id = ? AND skill_id = ?').run(imageId, skillId);
      if (result.changes === 0) throw new Error('备注图片不存在');
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
    if (!exists) throw new Error('Skill 不存在或尚未建立索引');
  }
}

function mapImage(row: ImageRow): SkillNoteImage {
  const content = Buffer.from(row.content);
  return {
    id: row.id,
    skillId: row.skill_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    dataUrl: toDataUrl(row.mime_type, content),
    createdAt: row.created_at
  };
}

function toDataUrl(mimeType: SkillNoteImage['mimeType'], content: Buffer): string {
  return `data:${mimeType};base64,${content.toString('base64')}`;
}

function detectRasterImage(content: Buffer): SkillNoteImage['mimeType'] | null {
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'image/jpeg';
  if (content.length >= 6 && (content.subarray(0, 6).toString('ascii') === 'GIF87a' || content.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  if (content.length >= 12 && content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
