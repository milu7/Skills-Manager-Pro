import { Bot, CheckCircle2, KeyRound, LoaderCircle, Plus, Save, Server, Trash2, XCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiProvider, AiProtocol, SaveAiProviderInput } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { Field, StatusPill, formatDate } from './common';

const blankForm: SaveAiProviderInput = {
  name: '', protocol: 'chat_completions', baseUrl: 'https://api.openai.com', model: '', timeoutMs: 60_000, headers: {}, apiKey: '', enabled: true
};

export function ProviderSettings() {
  const providers = useWorkbenchStore((state) => state.providers);
  const updateProviders = useWorkbenchStore((state) => state.updateProviders);
  const notify = useWorkbenchStore((state) => state.notify);
  const [selectedId, setSelectedId] = useState<string | null>(providers[0]?.id ?? null);
  const [form, setForm] = useState<SaveAiProviderInput>(blankForm);
  const [headersText, setHeadersText] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const selected = providers.find((provider) => provider.id === selectedId);
    if (selected) loadProvider(selected);
  }, [selectedId]);

  const loadProvider = (provider: AiProvider) => {
    setSelectedId(provider.id);
    setForm({ id: provider.id, name: provider.name, protocol: provider.protocol, baseUrl: provider.baseUrl, model: provider.model, timeoutMs: provider.timeoutMs, headers: provider.headers, apiKey: '', enabled: provider.enabled });
    setHeadersText(JSON.stringify(provider.headers, null, 2));
    setTestResult(null);
  };
  const createNew = () => { setSelectedId(null); setForm(blankForm); setHeadersText('{}'); setTestResult(null); };
  const refresh = async (prefer?: string) => {
    const next = await window.workbench.providers.list(); updateProviders(next);
    if (prefer) setSelectedId(prefer);
  };
  const save = async () => {
    setBusy(true);
    try {
      const headers = JSON.parse(headersText) as unknown;
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('可选请求头必须是 JSON 对象');
      const provider = await window.workbench.providers.save({ ...form, headers: headers as Record<string, string> });
      await refresh(provider.id); notify('success', 'AI 服务配置已加密保存');
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const test = async () => {
    if (!form.id) return;
    setBusy(true);
    try { const result = await window.workbench.providers.test(form.id); setTestResult(result); await refresh(form.id); notify(result.ok ? 'success' : 'error', result.message); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!form.id) return;
    setBusy(true);
    try { await window.workbench.providers.remove(form.id); await refresh(); createNew(); notify('success', '服务配置已移除；已有分析历史会保留'); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <main className="wide-panel providers-page">
      <header className="wide-header"><div><span className="eyebrow">软件设置</span><h1>AI 服务设置</h1><p>兼容 Chat Completions 与 Responses。密钥只在主进程解密。</p></div><button className="button secondary" onClick={createNew}><Plus size={15} />新建服务</button></header>
      <div className="settings-layout">
        <aside className="provider-list">
          <header><span>已配置</span><b>{providers.length}</b></header>
          {providers.map((provider) => (
            <button type="button" key={provider.id} className={selectedId === provider.id ? 'is-active' : ''} onClick={() => loadProvider(provider)}>
              <span className="provider-icon"><Bot size={17} /></span><div><strong>{provider.name}</strong><small>{provider.model}</small><em>{provider.protocol === 'responses' ? 'Responses' : 'Chat Completions'}</em></div><i className={provider.lastTestStatus === 'success' ? 'ok' : provider.lastTestStatus === 'failure' ? 'fail' : ''} />
            </button>
          ))}
          {providers.length === 0 && <div className="provider-empty"><Server size={22} /><p>尚未配置服务</p></div>}
        </aside>
        <section className="provider-form">
          <div className="provider-form-head"><div><span className="eyebrow">{form.id ? '编辑连接' : '新建连接'}</span><h2>{form.id ? form.name : '新建 AI 服务'}</h2></div>{form.id && <StatusPill tone={form.enabled ? 'green' : 'neutral'}>{form.enabled ? '已启用' : '已停用'}</StatusPill>}</div>
          <div className="form-grid two">
            <Field label="配置名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如 OpenAI" /></Field>
            <Field label="协议"><select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as AiProtocol })}><option value="chat_completions">/v1/chat/completions</option><option value="responses">/v1/responses</option></select></Field>
          </div>
          <Field label="接口地址（Base URL）" hint="可填 https://api.example.com 或以 /v1 结尾的兼容地址。"><input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.openai.com" /></Field>
          <div className="form-grid two">
            <Field label="模型"><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="模型 ID" /></Field>
            <Field label="超时（秒）"><input type="number" min={5} max={300} value={Math.round(form.timeoutMs / 1000)} onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) * 1000 })} /></Field>
          </div>
          <Field label="接口密钥（API Key）" hint={form.id ? '留空会保留原密钥；工作台不会将明文写入数据库或日志。' : '由 Windows DPAPI 通过 Electron safeStorage 保护。'}><div className="secret-input"><KeyRound size={16} /><input type="password" value={form.apiKey ?? ''} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={form.id ? '••••••••（保持不变）' : '输入 API Key'} /></div></Field>
          <Field label="自定义请求头（JSON）" hint="空值会保留同名旧值；删除字段可移除请求头。"><textarea className="code-textarea" rows={5} value={headersText} onChange={(event) => setHeadersText(event.target.value)} spellCheck={false} /></Field>
          <label className="toggle-row"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /><span><strong>启用此服务</strong><small>停用后不能发起新分析，历史仍保留。</small></span></label>
          {testResult && <div className={`connection-result ${testResult.ok ? 'is-ok' : 'is-fail'}`}>{testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<span>{testResult.message}</span></div>}
          <footer className="provider-actions">
            <div>{form.id && <><button className="button secondary" disabled={busy} onClick={() => void test()}><Zap size={15} />测试连接</button><button className="button ghost danger-text" disabled={busy} onClick={() => void remove()}><Trash2 size={15} />移除</button></>}</div>
            <button className="button primary" disabled={busy || !form.name || !form.baseUrl || !form.model} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}加密保存</button>
          </footer>
          {form.id && <p className="provider-timestamp">上次修改 {formatDate(providers.find((item) => item.id === form.id)?.updatedAt ?? null)}</p>}
        </section>
      </div>
    </main>
  );
}
