import { describe, expect, it } from 'vitest';
import { analyzeDocument, healthFromDiagnostics, suggestCategory } from '../../src/main/analysis/local-analyzer';
import { parseSkillDocument } from '../../src/main/skill-document';

describe('local analyzer', () => {
  it('recognizes WorkBuddy title/summary while flagging legacy metadata', () => {
    const parsed = parseSkillDocument(`---\ntitle: Legacy name\nsummary: Legacy summary\n---\n\nBody`);
    const diagnostics = analyzeDocument({
      host: 'workbuddy', folderName: 'Legacy name', parsed, mainFileBytes: 80,
      hasScripts: false, binaryCount: 0, brokenLinks: [], escapedSymlink: false
    });
    expect(diagnostics.some((item) => item.code === 'workbuddy-legacy-metadata')).toBe(true);
    expect(diagnostics.some((item) => item.code === 'name-missing')).toBe(false);
  });

  it('detects scripts, broken references and escaped symlinks without execution', () => {
    const parsed = parseSkillDocument(`---\nname: demo\ndescription: Test\n---\n\nBody`);
    const diagnostics = analyzeDocument({
      host: 'codex', folderName: 'demo', parsed, mainFileBytes: 300 * 1024,
      hasScripts: true, binaryCount: 2, brokenLinks: [{ path: '../secret.txt', outside: true }], escapedSymlink: true
    });
    expect(healthFromDiagnostics(diagnostics)).toBe('error');
    expect(diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(['scripts-present', 'binary-present', 'link-outside-skill', 'symlink-outside-root']));
  });

  it('suggests an initial category from the skill semantics', () => {
    expect(suggestCategory('cover-maker', '创建视觉封面与海报设计', 'image design')).toBe('视觉设计');
  });

  it('emits stable diagnostic parameters while retaining Chinese fallbacks', () => {
    const parsed = parseSkillDocument(`---\nname: other-name\ndescription: Test\n---\n\nBody`);
    const diagnostics = analyzeDocument({
      host: 'codex', folderName: 'demo', parsed, mainFileBytes: 300 * 1024,
      hasScripts: false, binaryCount: 3, brokenLinks: [{ path: 'missing.md', outside: false }], escapedSymlink: false
    });
    expect(diagnostics.find((item) => item.code === 'name-folder-mismatch')?.params).toEqual({
      name: 'other-name', folderName: 'demo'
    });
    expect(diagnostics.find((item) => item.code === 'main-file-large')?.params).toMatchObject({
      sizeBytes: 300 * 1024, size: '300.0 KB', formattedSize: '300.0 KB'
    });
    expect(diagnostics.find((item) => item.code === 'binary-present')?.params).toEqual({ count: 3 });
    expect(diagnostics.find((item) => item.code === 'link-missing')?.params).toEqual({ path: 'missing.md' });
  });

  it('uses a stable code for unterminated frontmatter instead of persisting localized parser text', () => {
    const parsed = parseSkillDocument('---\nname: demo\n');
    const diagnostics = analyzeDocument({
      host: 'codex', folderName: 'demo', parsed, mainFileBytes: 20,
      hasScripts: false, binaryCount: 0, brokenLinks: [], escapedSymlink: false
    });
    expect(diagnostics.some((item) => item.code === 'frontmatter-unclosed')).toBe(true);
  });
});
