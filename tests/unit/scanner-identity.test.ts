import { describe, expect, it } from 'vitest';
import path from 'node:path';
import type { SkillRoot } from '../../src/shared/types';
import { inferIdentity, inferParentPlugin } from '../../src/main/scanner-service';
import { toolHostKey } from '../../src/shared/ai-tool-catalog';

const root: SkillRoot = {
  id: 'root',
  label: 'Codex cache',
  path: 'C:\\Users\\Test\\.codex\\plugins\\cache',
  host: 'codex',
  scope: 'plugin',
  sourceType: 'cache',
  writable: false,
  recursive: true,
  enabled: true,
  discovered: true,
  lastScannedAt: null,
  skillCount: 0
};

describe('scanner source and parent plugin identity', () => {
  it('extracts plugin and publisher from versioned cache paths', () => {
    const skillPath = path.join(root.path, 'openai-bundled', 'browser', '1.2.3', 'skills', 'control');
    expect(inferParentPlugin(skillPath)).toBe('browser@openai-bundled');
  });

  it('extracts marketplace plugin names without confusing the marketplace for the plugin', () => {
    const skillPath = 'C:\\Users\\Test\\.claude\\plugins\\marketplaces\\official\\plugins\\feature-dev\\skills\\helper';
    expect(inferParentPlugin(skillPath)).toBe('feature-dev@official');
  });

  it('classifies plugin backup folders as read-only backups before cache', () => {
    const skillPath = path.join(root.path, 'openai-bundled', 'plugin-backup-old', 'browser', 'skills', 'control');
    expect(inferIdentity(root, skillPath)).toMatchObject({ sourceType: 'backup', writable: false });
  });

  it('keeps an unrecognized user-added root under the custom host without treating it as a category', () => {
    const customRoot: SkillRoot = {
      ...root,
      id: 'custom-root',
      label: 'My tools',
      path: 'D:\\Projects\\my-tools',
      host: 'custom',
      scope: 'project',
      sourceType: 'project',
      writable: true,
      discovered: false
    };
    expect(inferIdentity(customRoot, 'D:\\Projects\\my-tools\\skills\\helper')).toMatchObject({
      host: 'custom',
      scope: 'project',
      sourceType: 'project',
      writable: true
    });
  });

  it('keeps a discovered tool host like TRAE instead of collapsing it into custom', () => {
    const traeRoot: SkillRoot = {
      ...root,
      id: 'trae-root',
      label: 'TRAE IDE Skills',
      path: 'C:\\Users\\Test\\.trae\\skills',
      host: 'trae',
      scope: 'user',
      sourceType: 'user',
      writable: true,
      discovered: true
    };
    expect(inferIdentity(traeRoot, 'C:\\Users\\Test\\.trae\\skills\\code-reviewer')).toMatchObject({
      host: 'trae',
      scope: 'user',
      sourceType: 'user',
      writable: true
    });
  });

  it('still re-infers the host from path markers inside custom roots', () => {
    const customRoot: SkillRoot = {
      ...root,
      id: 'custom-root-2',
      label: 'Vendor tree',
      path: 'D:\\Vendor',
      host: 'custom',
      scope: 'project',
      sourceType: 'project',
      writable: true,
      discovered: false
    };
    expect(inferIdentity(customRoot, 'D:\\Vendor\\.claude\\skills\\helper')).toMatchObject({ host: 'claude' });
    expect(inferIdentity(customRoot, 'D:\\Vendor\\.agents\\skills\\helper')).toMatchObject({ host: 'codex' });
  });
});

describe('catalog tool host mapping', () => {
  it('maps every catalog tool to its own host id', () => {
    expect(toolHostKey('trae')).toBe('trae');
    expect(toolHostKey('cursor')).toBe('cursor');
    expect(toolHostKey('windsurf')).toBe('windsurf');
  });

  it('aliases tools that reuse a first-class host directory', () => {
    expect(toolHostKey('claude_code')).toBe('claude');
    expect(toolHostKey('cline')).toBe('codex');
    expect(toolHostKey('warp')).toBe('codex');
    expect(toolHostKey('trae_cn_builtin')).toBe('trae');
    expect(toolHostKey('trae_cn_plugins')).toBe('trae');
  });
});
