import { Bot, CheckCircle2, Globe2, KeyRound, LoaderCircle, Plus, Save, Server, Trash2, XCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiProvider, AiProtocol, SaveAiProviderInput } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { Field, StatusPill, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import { i18n, initializeRendererI18n } from '../i18n';
import type { LocalePreference } from '../../shared/types';

const blankForm: SaveAiProviderInput = {
  name: '', protocol: 'chat_completions', baseUrl: 'https://api.openai.com', model: '', timeoutMs: 60_000, headers: {}, apiKey: '', enabled: true
};

export function ProviderSettings() {
  const { t } = useTranslation();
  const providers = useWorkbenchStore((state) => state.providers);
  const updateProviders = useWorkbenchStore((state) => state.updateProviders);
  const notify = useWorkbenchStore((state) => state.notify);
  const locale = useWorkbenchStore((state) => state.bootstrap?.locale);
  const updateLocale = useWorkbenchStore((state) => state.updateLocale);
  const refreshList = useWorkbenchStore((state) => state.refreshList);
  const refreshDetails = useWorkbenchStore((state) => state.refreshDetails);
  const section = useWorkbenchStore((state) => state.settingsSection);
  const setSection = useWorkbenchStore((state) => state.setSettingsSection);
  const [selectedId, setSelectedId] = useState<string | null>(providers[0]?.id ?? null);
  const [form, setForm] = useState<SaveAiProviderInput>(blankForm);
  const [headersText, setHeadersText] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [localeBusy, setLocaleBusy] = useState(false);

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
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error(t('settings:providers.invalidHeaders'));
      const provider = await window.workbench.providers.save({ ...form, headers: headers as Record<string, string> });
      await refresh(provider.id); notify('success', t('settings:providers.saved'));
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
    try { await window.workbench.providers.remove(form.id); await refresh(); createNew(); notify('success', t('settings:providers.removed')); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const changeLocale = async (preference: LocalePreference) => {
    setLocaleBusy(true);
    try {
      const next = await window.workbench.settings.setLocalePreference(preference);
      await initializeRendererI18n(next.resolvedLocale);
      updateLocale(next);
      await refreshList();
      await refreshDetails();
      notify('success', i18n.t('settings:language.saved'));
    } catch (error) { notify('error', readableError(error)); }
    finally { setLocaleBusy(false); }
  };

  return (
    <main className="wide-panel providers-page">
      <header className="wide-header"><div><span className="eyebrow">{t('settings:eyebrow')}</span><h1>{t('settings:title')}</h1><p>{t('settings:subtitle')}</p></div>{section === 'ai' && <button className="button secondary" onClick={createNew}><Plus size={15} />{t('settings:providers.create')}</button>}</header>
      <nav className="settings-tabs" aria-label={t('settings:title')}>
        <button type="button" data-testid="settings-general-tab" className={section === 'general' ? 'is-active' : ''} onClick={() => setSection('general')}>{t('settings:generalTab')}</button>
        <button type="button" data-testid="settings-ai-tab" className={section === 'ai' ? 'is-active' : ''} onClick={() => setSection('ai')}>{t('settings:aiTab')}</button>
      </nav>
      {section === 'general' ? (
        <section className="general-settings-card">
          <div className="settings-card-icon"><Globe2 size={22} /></div>
          <div className="settings-card-copy"><h2>{t('settings:language.title')}</h2><p>{t('settings:language.detail')}</p></div>
          <Field label={t('settings:language.label')}>
            <select data-testid="locale-select" value={locale?.preference ?? 'system'} disabled={localeBusy} onChange={(event) => void changeLocale(event.target.value as LocalePreference)}>
              <option value="system">{t('locale.system')}</option>
              <option value="zh-CN">{t('locale.zhCN')}</option>
              <option value="en-US">{t('locale.enUS')}</option>
            </select>
          </Field>
        </section>
      ) : <>
      <div className="settings-section-heading"><h2>{t('settings:providers.title')}</h2><p>{t('settings:providers.subtitle')}</p></div>
      <div className="settings-layout">
        <aside className="provider-list">
          <header><span>{t('settings:providers.configured')}</span><b>{providers.length}</b></header>
          {providers.map((provider) => (
            <button type="button" key={provider.id} className={selectedId === provider.id ? 'is-active' : ''} onClick={() => loadProvider(provider)}>
              <span className="provider-icon"><Bot size={17} /></span><div><strong>{provider.name}</strong><small>{provider.model}</small><em>{provider.protocol === 'responses' ? 'Responses' : 'Chat Completions'}</em></div><i className={provider.lastTestStatus === 'success' ? 'ok' : provider.lastTestStatus === 'failure' ? 'fail' : ''} />
            </button>
          ))}
          {providers.length === 0 && <div className="provider-empty"><Server size={22} /><p>{t('settings:providers.empty')}</p></div>}
        </aside>
        <section className="provider-form">
          <div className="provider-form-head"><div><span className="eyebrow">{form.id ? t('settings:providers.edit') : t('settings:providers.newConnection')}</span><h2>{form.id ? form.name : t('settings:providers.newService')}</h2></div>{form.id && <StatusPill tone={form.enabled ? 'green' : 'neutral'}>{form.enabled ? t('status.enabled') : t('status.disabled')}</StatusPill>}</div>
          <div className="form-grid two">
            <Field label={t('settings:providers.name')}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('settings:providers.namePlaceholder')} /></Field>
            <Field label={t('settings:providers.protocol')}><select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as AiProtocol })}><option value="chat_completions">/v1/chat/completions</option><option value="responses">/v1/responses</option></select></Field>
          </div>
          <Field label={t('settings:providers.baseUrl')} hint={t('settings:providers.baseUrlHint')}><input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.openai.com" /></Field>
          <div className="form-grid two">
            <Field label={t('settings:providers.model')}><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder={t('settings:providers.modelPlaceholder')} /></Field>
            <Field label={t('settings:providers.timeout')}><input type="number" min={5} max={300} value={Math.round(form.timeoutMs / 1000)} onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) * 1000 })} /></Field>
          </div>
          <Field label={t('settings:providers.apiKey')} hint={form.id ? t('settings:providers.apiKeyExistingHint') : t('settings:providers.apiKeyNewHint')}><div className="secret-input"><KeyRound size={16} /><input type="password" value={form.apiKey ?? ''} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={form.id ? t('settings:providers.apiKeyKeep') : t('settings:providers.apiKeyPlaceholder')} /></div></Field>
          <Field label={t('settings:providers.headers')} hint={t('settings:providers.headersHint')}><textarea className="code-textarea" rows={5} value={headersText} onChange={(event) => setHeadersText(event.target.value)} spellCheck={false} /></Field>
          <label className="toggle-row"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /><span><strong>{t('settings:providers.enable')}</strong><small>{t('settings:providers.enableHint')}</small></span></label>
          {testResult && <div className={`connection-result ${testResult.ok ? 'is-ok' : 'is-fail'}`}>{testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<span>{testResult.message}</span></div>}
          <footer className="provider-actions">
            <div>{form.id && <><button className="button secondary" disabled={busy} onClick={() => void test()}><Zap size={15} />{t('action.test')}</button><button className="button ghost danger-text" disabled={busy} onClick={() => void remove()}><Trash2 size={15} />{t('settings:providers.remove')}</button></>}</div>
            <button className="button primary" disabled={busy || !form.name || !form.baseUrl || !form.model} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{t('settings:providers.encryptedSave')}</button>
          </footer>
          {form.id && <p className="provider-timestamp">{t('settings:providers.updated', { date: formatDate(providers.find((item) => item.id === form.id)?.updatedAt ?? null) })}</p>}
        </section>
      </div>
      </>}
    </main>
  );
}
