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
});
