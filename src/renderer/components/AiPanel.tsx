import { Bot, CheckCircle2, ChevronRight, CircleGauge, FileLock2, LoaderCircle, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AiAnalysis, AiAttachmentReason, AiInputPreview, SkillDetails } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { Modal, StatusPill, formatBytes, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import { activeLocale, translatedCategory } from '../i18n';

export function AiPanel({ skill }: { skill: SkillDetails }) {
  const { t } = useTranslation();
  const providers = useWorkbenchStore((state) => state.providers);
  const setView = useWorkbenchStore((state) => state.setView);
  const setSettingsSection = useWorkbenchStore((state) => state.setSettingsSection);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshDetails = useWorkbenchStore((state) => state.refreshDetails);
  const [providerId, setProviderId] = useState(providers.find((provider) => provider.enabled)?.id ?? '');
  const [preview, setPreview] = useState<AiInputPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(skill.latestAiAnalysis);

  useEffect(() => { setAnalysis(skill.latestAiAnalysis); setPreview(null); setSelected([]); }, [skill.id, skill.contentHash, skill.latestAiAnalysis]);
  useEffect(() => { if (!providers.some((provider) => provider.id === providerId && provider.enabled)) setProviderId(providers.find((provider) => provider.enabled)?.id ?? ''); }, [providers, providerId]);

  const selectedBytes = useMemo(() => selected.reduce((sum, path) => sum + (preview?.attachments.find((item) => item.relativePath === path)?.sizeBytes ?? 0), 0), [selected, preview]);

  const loadPreview = async () => {
    setBusy(true);
    try { setPreview(await window.workbench.analysis.previewAiInput(skill.id)); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const run = async () => {
    if (!providerId) return;
    setBusy(true);
    try {
      const result = await window.workbench.analysis.runAi({ skillId: skill.id, providerId, attachments: selected, expectedHash: skill.contentHash, outputLocale: activeLocale() });
      setAnalysis(result); setConfirmOpen(false); notify('success', t('workbench:ai.completed')); await refreshDetails();
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    await window.workbench.analysis.cancel(skill.id);
  };

  return (
    <div className="tab-scroll ai-panel">
      <div className="ai-privacy-banner"><FileLock2 size={20} /><div><strong>{t('workbench:ai.privacyTitle')}</strong><p>{t('workbench:ai.privacyDetail')}</p></div></div>

      <section className="overview-section ai-run-card">
        <div className="section-title"><div><span className="eyebrow">{t('workbench:ai.onDemand')}</span><h3>{t('workbench:ai.structured')}</h3></div><StatusPill tone="purple">{t('workbench:ai.manual')}</StatusPill></div>
        {providers.filter((provider) => provider.enabled).length === 0 ? (
          <button className="configure-provider" type="button" onClick={() => { setSettingsSection('ai'); setView('settings'); }}><Sparkles size={19} /><div><strong>{t('workbench:ai.configureTitle')}</strong><span>{t('workbench:ai.configureDetail')}</span></div><ChevronRight size={17} /></button>
        ) : (
          <div className="ai-controls">
            <label><span>{t('workbench:ai.providerModel')}</span><select value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.filter((provider) => provider.enabled).map((provider) => <option value={provider.id} key={provider.id}>{provider.name} · {provider.model}</option>)}</select></label>
            {!preview ? <button className="button primary" type="button" disabled={busy} onClick={() => void loadPreview()}>{busy ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}{t('workbench:ai.preview')}</button> : <button className="button secondary compact" type="button" disabled={busy} onClick={() => void loadPreview()}><RefreshCw size={14} />{t('workbench:ai.refreshPreview')}</button>}
          </div>
        )}
        {preview && (
          <div className="attachment-preview">
            <div className="main-input-row"><CheckCircle2 size={16} /><div><strong>SKILL.md</strong><span>{formatBytes(preview.mainFileBytes)} · {t('workbench:ai.required')}</span></div></div>
            {preview.attachments.length > 0 && <div className="attachment-heading"><span>{t('workbench:ai.optionalAttachments')}</span><b>{formatBytes(selectedBytes)} / {formatBytes(preview.attachmentBudgetBytes)}</b></div>}
            {preview.attachments.map((attachment) => (
              <label className="attachment-row" key={attachment.relativePath}><input type="checkbox" checked={selected.includes(attachment.relativePath)} onChange={(event) => setSelected(event.target.checked ? [...selected, attachment.relativePath] : selected.filter((item) => item !== attachment.relativePath))} /><div><strong>{attachment.relativePath}</strong><span>{translateAttachmentReason(t, attachment.reason)}</span></div><em>{formatBytes(attachment.sizeBytes)}</em></label>
            ))}
            {preview.excluded.length > 0 && <details className="excluded-files"><summary>{t('workbench:ai.excluded', { count: preview.excluded.length })}</summary>{preview.excluded.map((file) => <div key={`${file.relativePath}-${file.reason}`}><span>{file.relativePath}</span><em>{translateAttachmentReason(t, file.reason)}</em></div>)}</details>}
            <div className="ai-send-footer"><span>{t('workbench:ai.estimated', { count: preview.estimatedCharacters.toLocaleString(activeLocale()) })}</span><button className="button primary" type="button" disabled={selectedBytes > preview.attachmentBudgetBytes || busy} onClick={() => setConfirmOpen(true)}><Send size={15} />{t('action.continue')}</button></div>
          </div>
        )}
      </section>

      {analysis && <AnalysisResult analysis={analysis} />}

      {preview && <Modal open={confirmOpen} onOpenChange={(open) => { if (!busy) setConfirmOpen(open); }} title={t('workbench:ai.confirmTitle')} description={t('workbench:ai.confirmDetail')} size="medium" footer={<>{busy ? <button className="button danger" onClick={() => void cancel()}>{t('workbench:ai.cancelRequest')}</button> : <button className="button secondary" onClick={() => setConfirmOpen(false)}>{t('workbench:ai.backCheck')}</button>}<button className="button primary" disabled={busy} onClick={() => void run()}>{busy && <LoaderCircle className="spin" size={15} />}{t('workbench:ai.confirmSend')}</button></>}>
        <div className="send-manifest"><div><strong>SKILL.md</strong><span>{formatBytes(preview.mainFileBytes)}</span></div>{selected.map((path) => <div key={path}><strong>{path}</strong><span>{formatBytes(preview.attachments.find((item) => item.relativePath === path)?.sizeBytes ?? 0)}</span></div>)}</div>
      </Modal>}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: AiAnalysis }) {
  const { t } = useTranslation();
  const outputLocale = analysis.outputLocale ?? 'zh-CN';
  const localeName = outputLocale === 'en-US' ? t('locale.enUS') : t('locale.zhCN');
  return (
    <section className="overview-section ai-result">
      <div className="section-title"><div><span className="eyebrow">{t('workbench:ai.resultEyebrow')}</span><h3>{t('workbench:ai.latest')}</h3></div><div className="result-status">{analysis.stale ? <StatusPill tone="amber">{t('status.stale')}</StatusPill> : <StatusPill tone="green">{t('status.current')}</StatusPill>}<span>{formatDate(analysis.createdAt)}</span></div></div>
      <div className="analysis-provider"><Bot size={16} /><span>{analysis.providerName}</span><code>{analysis.model}</code><i>{analysis.protocol === 'responses' ? 'Responses' : 'Chat'}</i></div>
      <div className="analysis-locale"><span>{t('workbench:ai.resultLanguage', { locale: localeName })}</span>{outputLocale !== activeLocale() && <em>{t('workbench:ai.oldLanguage', { locale: localeName })}</em>}</div>
      <p className="analysis-summary">{analysis.summary}</p>
      <div className="analysis-grid">
        <AnalysisList title={t('workbench:ai.capabilities')} items={analysis.capabilities} />
        <AnalysisList title={t('workbench:ai.improvements')} items={analysis.improvementSuggestions} />
        <AnalysisList title={t('workbench:ai.compatibility')} items={analysis.compatibilityNotes} />
        <AnalysisList title={t('workbench:ai.risks')} items={analysis.riskFlags} warning />
      </div>
      <div className="analysis-footer"><div><span>{t('workbench:ai.recommendedCategory')}</span><strong>{translatedCategory(t, analysis.recommendedCategory)}</strong></div><div><span>{t('workbench:ai.tags')}</span><strong>{analysis.tags.join(' · ') || '—'}</strong></div><div><span>{t('workbench:ai.confidence')}</span><strong><CircleGauge size={14} />{Math.round(analysis.confidence * 100)}%</strong></div></div>
    </section>
  );
}

function AnalysisList({ title, items, warning }: { title: string; items: string[]; warning?: boolean }) {
  const { t } = useTranslation();
  return <div className="analysis-list"><h4>{warning && <TriangleAlert size={14} />}{title}</h4>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{t('status.none')}</p>}</div>;
}

const ATTACHMENT_REASON_KEYS: Record<AiAttachmentReason, string> = {
  'file-too-large': 'singleLarge',
  'host-metadata': 'hostMetadata',
  'text-attachment': 'textAttachment',
  'script-never': 'scriptNever',
  'binary-never': 'binaryNever',
  'over-limit': 'overLimit'
};

// #15: reasons are stable enum codes from the main process; only the display
// text is localized here.
function translateAttachmentReason(t: ReturnType<typeof useTranslation>['t'], reason: AiAttachmentReason): string {
  return t(`messages:attachment.${ATTACHMENT_REASON_KEYS[reason]}`);
}
