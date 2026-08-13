import { parseDocument, type Document } from 'yaml';

export interface ParsedSkillDocument {
  raw: string;
  frontmatterRaw: string | null;
  body: string;
  frontmatter: Record<string, unknown>;
  document: Document.Parsed | null;
  errors: string[];
  hasFrontmatter: boolean;
}

interface FrontmatterParts {
  before: string;
  yaml: string;
  after: string;
}

function splitFrontmatter(raw: string): FrontmatterParts | null {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const lines = normalized.split('\n');
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---' || lines[index] === '...') {
      end = index;
      break;
    }
  }
  if (end < 0) return null;
  return {
    before: '---\n',
    yaml: lines.slice(1, end).join('\n'),
    after: lines.slice(end + 1).join('\n')
  };
}

export function parseSkillDocument(raw: string): ParsedSkillDocument {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = splitFrontmatter(normalized);
  if (!parts) {
    return {
      raw: normalized,
      frontmatterRaw: null,
      body: normalized,
      frontmatter: {},
      document: null,
      errors: normalized.startsWith('---') ? ['YAML frontmatter 缺少结束分隔符'] : [],
      hasFrontmatter: false
    };
  }

  const document = parseDocument(parts.yaml, {
    keepSourceTokens: true,
    prettyErrors: true,
    strict: false
  });
  const errors = document.errors.map((error) => error.message);
  let frontmatter: Record<string, unknown> = {};
  if (errors.length === 0) {
    const value = document.toJS({ maxAliasCount: 50 }) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      frontmatter = value as Record<string, unknown>;
    }
  }
  return {
    raw: normalized,
    frontmatterRaw: parts.yaml,
    body: parts.after.replace(/^\n/, ''),
    frontmatter,
    document,
    errors,
    hasFrontmatter: true
  };
}

function stringifyDocument(document: Document.Parsed): string {
  return document.toString({ lineWidth: 0 }).replace(/\n$/, '');
}

export function updateSkillMetadata(
  parsed: ParsedSkillDocument,
  updates: { name?: string; description?: string }
): string {
  if (parsed.errors.length > 0) {
    throw new Error('YAML frontmatter 已损坏，请先在高级文本编辑器中修复');
  }
  const document = parsed.document ?? parseDocument('');
  if (updates.name !== undefined) document.set('name', updates.name);
  if (updates.description !== undefined) document.set('description', updates.description);
  const yaml = stringifyDocument(document);
  return `---\n${yaml}\n---\n\n${parsed.body.replace(/^\n+/, '')}`;
}

export function updateSkillBody(parsed: ParsedSkillDocument, body: string): string {
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\n+/, '');
  if (!parsed.hasFrontmatter || parsed.frontmatterRaw === null) return normalizedBody;
  return `---\n${parsed.frontmatterRaw}\n---\n\n${normalizedBody}`;
}

export function updateArbitraryFrontmatterField(parsed: ParsedSkillDocument, key: string, value: string): string {
  if (parsed.errors.length > 0) throw new Error('YAML frontmatter 已损坏，无法安全修改');
  const document = parsed.document ?? parseDocument('');
  document.set(key, value);
  const yaml = stringifyDocument(document);
  return `---\n${yaml}\n---\n\n${parsed.body.replace(/^\n+/, '')}`;
}
