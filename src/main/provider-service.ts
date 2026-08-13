import { safeStorage } from 'electron';
import type { AiProtocol, AiProvider, SaveAiProviderInput } from '../shared/types';
import type { DatabaseContext } from './db/database';
import { createId, errorMessage, localizeMessage, nowIso, safeJsonParse, type MessageTranslator } from './utils';

const MASKED_VALUE = '';

export interface RuntimeProvider extends AiProvider {
  apiKey: string;
  runtimeHeaders: Record<string, string>;
}

export class ProviderService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly translate?: MessageTranslator
  ) {}

  list(): AiProvider[] {
    const rows = this.database.sqlite.prepare('SELECT * FROM providers ORDER BY enabled DESC, name COLLATE NOCASE').all() as Array<Record<string, unknown>>;
    return rows.map(mapProvider);
  }

  save(input: SaveAiProviderInput): AiProvider {
    const now = nowIso();
    const existing = input.id
      ? this.database.sqlite.prepare('SELECT * FROM providers WHERE id = ?').get(input.id) as Record<string, unknown> | undefined
      : undefined;
    const id = input.id ?? createId();
    const previousHeaders = existing ? this.decryptJsonHeaders(String(existing.headers_json)) : {};
    const mergedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.headers)) {
      assertHeaderName(key, this.translate);
      if (value.includes('\r') || value.includes('\n')) {
        throw new Error(localizeMessage(this.translate, 'error.providerHeaderNewline', `请求头 ${key} 包含非法换行`, { name: key }));
      }
      mergedHeaders[key] = value || previousHeaders[key] || '';
    }
    const encryptedHeaders = this.encrypt(JSON.stringify(mergedHeaders));
    let encryptedApiKey = existing?.encrypted_api_key ? String(existing.encrypted_api_key) : null;
    if (input.apiKey !== undefined && input.apiKey !== '') encryptedApiKey = this.encrypt(input.apiKey);
    this.database.sqlite.prepare(`
      INSERT INTO providers (
        id, name, protocol, base_url, model, timeout_ms, headers_json, encrypted_api_key,
        enabled, last_tested_at, last_test_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, protocol = excluded.protocol, base_url = excluded.base_url,
        model = excluded.model, timeout_ms = excluded.timeout_ms, headers_json = excluded.headers_json,
        encrypted_api_key = excluded.encrypted_api_key, enabled = excluded.enabled, updated_at = excluded.updated_at
    `).run(
      id, input.name, input.protocol, input.baseUrl.replace(/\/+$/, ''), input.model,
      input.timeoutMs, encryptedHeaders, encryptedApiKey, Number(input.enabled), existing?.created_at ?? now, now
    );
    return this.list().find((provider) => provider.id === id) ?? (() => {
      throw new Error(localizeMessage(this.translate, 'error.providerSaveFailed', 'AI 服务保存失败'));
    })();
  }

  remove(id: string): void {
    const analyses = this.database.sqlite.prepare('SELECT COUNT(*) AS count FROM ai_analyses WHERE provider_id = ?').get(id) as { count: number };
    if (analyses.count > 0) {
      this.database.sqlite.prepare('UPDATE providers SET enabled = 0, encrypted_api_key = NULL, updated_at = ? WHERE id = ?').run(nowIso(), id);
      return;
    }
    this.database.sqlite.prepare('DELETE FROM providers WHERE id = ?').run(id);
  }

  getRuntime(id: string): RuntimeProvider {
    const row = this.database.sqlite.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error(localizeMessage(this.translate, 'error.providerMissing', 'AI 服务配置不存在'));
    const provider = mapProvider(row);
    return {
      ...provider,
      apiKey: row.encrypted_api_key ? this.decrypt(String(row.encrypted_api_key)) : '',
      runtimeHeaders: this.decryptJsonHeaders(String(row.headers_json))
    };
  }

  async test(id: string): Promise<{ ok: boolean; message: string }> {
    const provider = this.getRuntime(id);
    const endpoint = providerEndpoint(provider.baseUrl, provider.protocol);
    const body = provider.protocol === 'chat_completions'
      ? { model: provider.model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 8 }
      : { model: provider.model, input: 'Reply with OK.', max_output_tokens: 8 };
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST', headers: providerHeaders(provider), body: JSON.stringify(body)
      }, provider.timeoutMs, this.translate);
      if (!response.ok) throw new Error(await safeHttpError(response));
      this.database.sqlite.prepare(`
        UPDATE providers SET last_tested_at = ?, last_test_status = 'success', updated_at = ? WHERE id = ?
      `).run(nowIso(), nowIso(), id);
      return {
        ok: true,
        message: localizeMessage(this.translate, 'success.providerConnected', `连接成功 · HTTP ${response.status}`, { status: response.status })
      };
    } catch (error) {
      this.database.sqlite.prepare(`
        UPDATE providers SET last_tested_at = ?, last_test_status = 'failure', updated_at = ? WHERE id = ?
      `).run(nowIso(), nowIso(), id);
      return { ok: false, message: redact(errorMessage(error), provider.apiKey) };
    }
  }

  private encrypt(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) throw new Error(localizeMessage(this.translate, 'error.secureStorageSaveUnavailable', '系统安全存储当前不可用，已拒绝保存明文密钥'));
    return safeStorage.encryptString(value).toString('base64');
  }

  private decrypt(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) throw new Error(localizeMessage(this.translate, 'error.secureStorageReadUnavailable', '系统安全存储当前不可用，无法读取密钥'));
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  }

  private decryptJsonHeaders(value: string): Record<string, string> {
    if (!value) return {};
    return safeJsonParse<Record<string, string>>(this.decrypt(value), {});
  }
}

function mapProvider(row: Record<string, unknown>): AiProvider {
  let headerNames: string[] = [];
  try {
    if (row.headers_json && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(String(row.headers_json), 'base64'));
      headerNames = Object.keys(safeJsonParse<Record<string, string>>(decrypted, {}));
    }
  } catch {
    headerNames = [];
  }
  return {
    id: String(row.id), name: String(row.name), protocol: row.protocol as AiProtocol,
    baseUrl: String(row.base_url), model: String(row.model), timeoutMs: Number(row.timeout_ms),
    headers: Object.fromEntries(headerNames.map((name) => [name, MASKED_VALUE])),
    hasApiKey: Boolean(row.encrypted_api_key), enabled: Boolean(row.enabled),
    lastTestedAt: row.last_tested_at ? String(row.last_tested_at) : null,
    lastTestStatus: (row.last_test_status as 'success' | 'failure' | null) ?? null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export function providerEndpoint(baseUrl: string, protocol: AiProtocol): string {
  const clean = baseUrl.replace(/\/+$/, '');
  const route = protocol === 'chat_completions' ? '/chat/completions' : '/responses';
  if (clean.toLocaleLowerCase('en-US').endsWith(route)) return clean;
  if (clean.toLocaleLowerCase('en-US').endsWith('/v1')) return `${clean}${route}`;
  return `${clean}/v1${route}`;
}

export function providerHeaders(provider: RuntimeProvider): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...provider.runtimeHeaders };
  const hasAuthorization = Object.keys(headers).some((name) => name.toLocaleLowerCase('en-US') === 'authorization');
  if (provider.apiKey && !hasAuthorization) headers.Authorization = `Bearer ${provider.apiKey}`;
  return headers;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  translate?: MessageTranslator
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      const seconds = Math.round(timeoutMs / 1000);
      throw new Error(localizeMessage(translate, 'error.requestTimeout', `请求超过 ${seconds} 秒，已取消`, { seconds }));
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export async function safeHttpError(response: Response): Promise<string> {
  let details = '';
  try {
    const text = await response.text();
    const parsed = safeJsonParse<{ error?: { message?: string }; message?: string }>(text, {});
    details = parsed.error?.message || parsed.message || text.slice(0, 500);
  } catch {
    details = '';
  }
  return `HTTP ${response.status}${details ? `: ${details}` : ''}`;
}

function assertHeaderName(name: string, translate?: MessageTranslator): void {
  const normalized = name.trim().toLocaleLowerCase('en-US');
  if (!normalized || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(normalized)) {
    throw new Error(localizeMessage(translate, 'error.headerInvalid', `请求头名称无效：${name}`, { name }));
  }
  if (['host', 'content-length', 'connection', 'transfer-encoding'].includes(normalized)) {
    throw new Error(localizeMessage(translate, 'error.headerForbidden', `不允许设置请求头：${name}`, { name }));
  }
}

function redact(message: string, secret: string): string {
  return secret ? message.split(secret).join('[REDACTED]') : message;
}
