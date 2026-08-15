import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const nowIso = (): string => new Date().toISOString();
export const createId = (): string => randomUUID();

export type MessageParams = Record<string, string | number>;
export type MessageTranslator = (key: string, params?: MessageParams) => string;

export function localizeMessage(
  translator: MessageTranslator | undefined,
  key: string,
  fallback: string,
  params?: MessageParams
): string {
  if (!translator) return fallback;
  const resourceKey = `messages:main.${key}`;
  try {
    const translated = translator(resourceKey, params);
    return translated && translated !== resourceKey && translated !== `main.${key}` ? translated : fallback;
  } catch {
    return fallback;
  }
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function normalizeFsPath(value: string): string {
  return path.resolve(value).replace(/[\\/]+$/, '').toLocaleLowerCase('en-US');
}

/**
 * Canonical logical name shared by family detection, duplicate name grouping
 * and the name-vs-folder diagnostic: trimmed, lowercased (en-US) and with runs
 * of whitespace, underscores and hyphens collapsed into a single hyphen.
 */
export function normalizeLogicalName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '-');
}

export function isPathInside(parentPath: string, childPath: string): boolean {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  // #18: Windows paths compare case-insensitively. Node's win32 path.relative
  // already does, but an explicit identity check keeps this contract explicit
  // and independent of that implementation detail (watcher events may arrive
  // with different casing than the configured root path).
  if (process.platform === 'win32' && parent.toLocaleLowerCase('en-US') === child.toLocaleLowerCase('en-US')) return true;
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertSafeRelativePath(relativePath: string, translator?: MessageTranslator): void {
  if (!relativePath || relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    throw new Error(localizeMessage(translator, 'error.invalidFilePath', '文件路径无效'));
  }
  const normalized = path.normalize(relativePath);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(localizeMessage(translator, 'error.pathEscapesSkill', '文件路径越过了 Skill 目录'));
  }
}

export function detectTextFormat(buffer: Buffer): {
  text: string;
  newline: 'lf' | 'crlf';
  hasBom: boolean;
} {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const text = buffer.subarray(hasBom ? 3 : 0).toString('utf8');
  return {
    text,
    newline: text.includes('\r\n') ? 'crlf' : 'lf',
    hasBom
  };
}

export function encodeText(text: string, newline: 'lf' | 'crlf', hasBom: boolean): Buffer {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withNewlines = newline === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
  const content = Buffer.from(withNewlines, 'utf8');
  return hasBom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), content]) : content;
}

export async function atomicWriteFile(targetPath: string, content: Buffer): Promise<void> {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(directory, `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, content, { flag: 'wx' });
  try {
    const handle = await fs.open(tempPath, 'r+');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== 'win32' || (code !== 'EEXIST' && code !== 'EPERM')) throw error;
      const backupPath = `${targetPath}.${randomUUID()}.swap`;
      await fs.rename(targetPath, backupPath);
      try {
        await fs.rename(tempPath, targetPath);
        await fs.rm(backupPath, { force: true });
      } catch (replaceError) {
        await fs.rename(backupPath, targetPath).catch(() => undefined);
        throw replaceError;
      }
    }
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
