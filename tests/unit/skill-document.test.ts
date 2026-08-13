import { describe, expect, it } from 'vitest';
import { parseSkillDocument, updateSkillBody, updateSkillMetadata } from '../../src/main/skill-document';

describe('skill document', () => {
  it('preserves comments and unknown YAML fields while updating known metadata', () => {
    const raw = `---\n# important\nname: demo\ndescription: old\nx-host-field: value\n---\n\n# Body\n`;
    const parsed = parseSkillDocument(raw);
    const updated = updateSkillMetadata(parsed, { description: 'new value' });
    expect(updated).toContain('# important');
    expect(updated).toContain('x-host-field: value');
    expect(updated).toContain('description: new value');
    expect(updated).toContain('# Body');
  });

  it('preserves frontmatter bytes logically while editing the body', () => {
    const raw = `---\nname: demo\ndescription: Test\n# trailing note\n---\n\nOld body`;
    const parsed = parseSkillDocument(raw);
    const updated = updateSkillBody(parsed, 'New body');
    expect(updated).toBe(`---\nname: demo\ndescription: Test\n# trailing note\n---\n\nNew body`);
  });

  it('reports damaged YAML without discarding the body', () => {
    const parsed = parseSkillDocument(`---\nname: [bad\n---\n\nBody`);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.body).toBe('Body');
    expect(() => updateSkillMetadata(parsed, { name: 'fixed' })).toThrow(/YAML/);
  });

  it('supports a markdown-only legacy document', () => {
    const parsed = parseSkillDocument('# No frontmatter');
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.body).toBe('# No frontmatter');
  });

  it('preserves Claude extension fields while editing standard metadata', () => {
    const raw = `---\nname: claude-helper\ndescription: Old\nallowed-tools:\n  - Read\nmodel: sonnet\ncontext: fork\nhooks:\n  PreToolUse: verify\n---\n\nBody`;
    const updated = updateSkillMetadata(parseSkillDocument(raw), { description: 'New' });
    expect(updated).toContain('allowed-tools:');
    expect(updated).toContain('model: sonnet');
    expect(updated).toContain('context: fork');
    expect(updated).toContain('PreToolUse: verify');
  });
});
