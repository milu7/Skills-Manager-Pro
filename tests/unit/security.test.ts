import { describe, expect, it } from 'vitest';
import { assertSafeRelativePath, detectTextFormat, encodeText } from '../../src/main/utils';
import { renameSchema, saveProviderSchema } from '../../src/shared/schemas';

describe('security boundaries', () => {
  it('rejects path traversal and absolute paths', () => {
    expect(() => assertSafeRelativePath('../secret.txt')).toThrow(/越过/);
    expect(() => assertSafeRelativePath('C:\\Windows\\system.ini')).toThrow(/无效/);
    expect(() => assertSafeRelativePath('references/guide.md')).not.toThrow();
  });

  it('rejects Windows-reserved rename characters', () => {
    expect(renameSchema.safeParse({ skillId: crypto.randomUUID(), newName: 'bad:name', expectedHash: 'a'.repeat(64) }).success).toBe(false);
  });

  it('only accepts HTTP(S) AI endpoints', () => {
    const result = saveProviderSchema.safeParse({
      name: 'unsafe', protocol: 'responses', baseUrl: 'file:///etc/passwd', model: 'x', timeoutMs: 5000, headers: {}, enabled: true
    });
    expect(result.success).toBe(false);
  });

  it('round-trips UTF-8 BOM and CRLF', () => {
    const source = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('line 1\r\nline 2\r\n')]);
    const parsed = detectTextFormat(source);
    expect(parsed).toMatchObject({ newline: 'crlf', hasBom: true });
    expect(encodeText(parsed.text, parsed.newline, parsed.hasBom)).toEqual(source);
  });
});
