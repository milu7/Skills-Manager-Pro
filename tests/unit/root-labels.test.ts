import { describe, expect, it } from 'vitest';
import { mapRoot } from '../../src/main/roots-service';

describe('built-in root labels', () => {
  it('adds stable label codes without replacing stored fallback labels', () => {
    const root = mapRoot({
      id: 'root', label: 'Codex 用户 Skills', path: 'C:\\Users\\Test\\.codex\\skills',
      host: 'codex', scope: 'user', source_type: 'user', writable: 1, recursive: 1,
      enabled: 1, discovered: 1, last_scanned_at: null, skill_count: 0
    });
    expect(root.label).toBe('Codex 用户 Skills');
    expect(root.labelCode).toBe('codexUser');
  });

  it('leaves user-added project labels untouched', () => {
    const root = mapRoot({
      id: 'root', label: '我的项目', path: 'D:\\Projects\\demo', host: 'custom',
      scope: 'project', source_type: 'project', writable: 1, recursive: 1,
      enabled: 1, discovered: 0, last_scanned_at: null, skill_count: 0
    });
    expect(root.labelCode).toBeUndefined();
  });
});
