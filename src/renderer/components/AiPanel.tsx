import { Bot, CheckCircle2, ChevronRight, CircleGauge, FileLock2, LoaderCircle, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AiAnalysis, AiInputPreview, SkillDetails } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { Modal, StatusPill, formatBytes, formatDate } from './common';

export function AiPanel({ skill }: { skill: SkillDetails }) {
  const providers = useWorkbenchStore((state) => state.providers);
  const setView = useWorkbenchStore((state) => state.setView);
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
      const result = await window.workbench.analysis.runAi({ skillId: skill.id, providerId, attachments: selected, expectedHash: skill.contentHash });
      setAnalysis(result); setConfirmOpen(false); notify('success', 'AI 分析完成；结果只作为建议保存'); await refreshDetails();
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    await window.workbench.analysis.cancel(skill.id);
  };

  return (
    <div className="tab-scroll ai-panel">
      <div className="ai-privacy-banner"><FileLock2 size={20} /><div><strong>由你决定何时、向哪里发送</strong><p>本地规则始终先运行。AI 不会自动调用，也不会执行或改写 Skill；脚本和二进制永不发送。</p></div></div>

      <section className="overview-section ai-run-card">
        <div className="section-title"><div><span className="eyebrow">按需分析</span><h3>发起结构化分析</h3></div><StatusPill tone="purple">手动触发</StatusPill></div>
        {providers.filter((provider) => provider.enabled).length === 0 ? (
          <button className="configure-provider" type="button" onClick={() => setView('providers')}><Sparkles size={19} /><div><strong>先配置一个 AI 服务</strong><span>支持 Chat Completions 与 Responses 兼容接口</span></div><ChevronRight size={17} /></button>
        ) : (
          <div className="ai-controls">
            <label><span>服务与模型</span><select value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.filter((provider) => provider.enabled).map((provider) => <option value={provider.id} key={provider.id}>{provider.name} · {provider.model}</option>)}</select></label>
            {!preview ? <button className="button primary" type="button" disabled={busy} onClick={() => void loadPreview()}>{busy ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}预览待发送内容</button> : <button className="button secondary compact" type="button" disabled={busy} onClick={() => void loadPreview()}><RefreshCw size={14} />刷新预览</button>}
          </div>
        )}
        {preview && (
          <div className="attachment-preview">
            <div className="main-input-row"><CheckCircle2 size={16} /><div><strong>SKILL.md</strong><span>{formatBytes(preview.mainFileBytes)} · 必须发送</span></div></div>
            {preview.attachments.length > 0 && <div className="attachment-heading"><span>可选文本附件</span><b>{formatBytes(selectedBytes)} / {formatBytes(preview.attachmentBudgetBytes)}</b></div>}
            {preview.attachments.map((attachment) => (
              <label className="attachment-row" key={attachment.relativePath}><input type="checkbox" checked={selected.includes(attachment.relativePath)} onChange={(event) => setSelected(event.target.checked ? [...selected, attachment.relativePath] : selected.filter((item) => item !== attachment.relativePath))} /><div><strong>{attachment.relativePath}</strong><span>{attachment.reason}</span></div><em>{formatBytes(attachment.sizeBytes)}</em></label>
            ))}
            {preview.excluded.length > 0 && <details className="excluded-files"><summary>{preview.excluded.length} 个文件不会发送</summary>{preview.excluded.map((file) => <div key={`${file.relativePath}-${file.reason}`}><span>{file.relativePath}</span><em>{file.reason}</em></div>)}</details>}
            <div className="ai-send-footer"><span>预计字符 {preview.estimatedCharacters.toLocaleString()} + 附件</span><button className="button primary" type="button" disabled={selectedBytes > preview.attachmentBudgetBytes || busy} onClick={() => setConfirmOpen(true)}><Send size={15} />继续确认</button></div>
          </div>
        )}
      </section>

      {analysis && <AnalysisResult analysis={analysis} />}

      {preview && <Modal open={confirmOpen} onOpenChange={(open) => { if (!busy) setConfirmOpen(open); }} title="确认发送分析内容" description="这是一次外部网络请求。只会发送下列已确认文本，结果不会自动应用。" size="medium" footer={<>{busy ? <button className="button danger" onClick={() => void cancel()}>取消请求</button> : <button className="button secondary" onClick={() => setConfirmOpen(false)}>返回检查</button>}<button className="button primary" disabled={busy} onClick={() => void run()}>{busy && <LoaderCircle className="spin" size={15} />}确认发送</button></>}>
        <div className="send-manifest"><div><strong>SKILL.md</strong><span>{formatBytes(preview.mainFileBytes)}</span></div>{selected.map((path) => <div key={path}><strong>{path}</strong><span>{formatBytes(preview.attachments.find((item) => item.relativePath === path)?.sizeBytes ?? 0)}</span></div>)}</div>
      </Modal>}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: AiAnalysis }) {
  return (
    <section className="overview-section ai-result">
      <div className="section-title"><div><span className="eyebrow">AI 分析结果</span><h3>最近分析</h3></div><div className="result-status">{analysis.stale ? <StatusPill tone="amber">内容已变化</StatusPill> : <StatusPill tone="green">当前版本</StatusPill>}<span>{formatDate(analysis.createdAt)}</span></div></div>
      <div className="analysis-provider"><Bot size={16} /><span>{analysis.providerName}</span><code>{analysis.model}</code><i>{analysis.protocol === 'responses' ? 'Responses' : 'Chat'}</i></div>
      <p className="analysis-summary">{analysis.summary}</p>
      <div className="analysis-grid">
        <AnalysisList title="能力" items={analysis.capabilities} />
        <AnalysisList title="改进建议" items={analysis.improvementSuggestions} />
        <AnalysisList title="兼容性" items={analysis.compatibilityNotes} />
        <AnalysisList title="风险" items={analysis.riskFlags} warning />
      </div>
      <div className="analysis-footer"><div><span>推荐分类</span><strong>{analysis.recommendedCategory}</strong></div><div><span>标签</span><strong>{analysis.tags.join(' · ') || '—'}</strong></div><div><span>置信度</span><strong><CircleGauge size={14} />{Math.round(analysis.confidence * 100)}%</strong></div></div>
    </section>
  );
}

function AnalysisList({ title, items, warning }: { title: string; items: string[]; warning?: boolean }) {
  return <div className="analysis-list"><h4>{warning && <TriangleAlert size={14} />}{title}</h4>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>无</p>}</div>;
}
