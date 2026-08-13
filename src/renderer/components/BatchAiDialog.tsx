import { FileLock2, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiInputPreview, SkillInstallation } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { Modal, formatBytes } from './common';

interface BatchItem {
  skill: SkillInstallation;
  preview: AiInputPreview | null;
  error: string | null;
}

export function BatchAiDialog({
  open,
  skills,
  onOpenChange
}: {
  open: boolean;
  skills: SkillInstallation[];
  onOpenChange(open: boolean): void;
}) {
  const allProviders = useWorkbenchStore((state) => state.providers);
  const providers = useMemo(() => allProviders.filter((provider) => provider.enabled), [allProviders]);
  const notify = useWorkbenchStore((state) => state.notify);
  const [providerId, setProviderId] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, failed: 0 });
  const currentSkillId = useRef<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!open) return;
    setProviderId((current) => providers.some((provider) => provider.id === current) ? current : providers[0]?.id ?? '');
    setProgress({ completed: 0, failed: 0 });
    cancelled.current = false;
    setLoading(true);
    void Promise.all(skills.map(async (skill): Promise<BatchItem> => {
      try {
        return { skill, preview: await window.workbench.analysis.previewAiInput(skill.id), error: null };
      } catch (error) {
        return { skill, preview: null, error: readableError(error) };
      }
    })).then(setItems).finally(() => setLoading(false));
  }, [open, providers, skills]);

  const run = async () => {
    if (!providerId || running) return;
    setRunning(true);
    cancelled.current = false;
    let completed = 0;
    let failed = 0;
    for (const item of items) {
      if (cancelled.current) break;
      if (!item.preview) { failed += 1; setProgress({ completed, failed }); continue; }
      currentSkillId.current = item.skill.id;
      try {
        await window.workbench.analysis.runAi({
          skillId: item.skill.id,
          providerId,
          attachments: [],
          expectedHash: item.skill.contentHash
        });
        completed += 1;
      } catch {
        if (!cancelled.current) failed += 1;
      }
      setProgress({ completed, failed });
    }
    currentSkillId.current = null;
    setRunning(false);
    if (cancelled.current) notify('info', `批量分析已停止 · 完成 ${completed}，失败 ${failed}`);
    else notify(failed ? 'error' : 'success', `批量分析结束 · 完成 ${completed}，失败 ${failed}`);
  };

  const cancel = async () => {
    cancelled.current = true;
    if (currentSkillId.current) await window.workbench.analysis.cancel(currentSkillId.current);
  };

  const readyCount = items.filter((item) => item.preview).length;
  const totalBytes = items.reduce((sum, item) => sum + (item.preview?.mainFileBytes ?? 0), 0);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!running) onOpenChange(next); }}
      title="批量 AI 分析确认"
      description="批量模式只发送下列 Skill 的 SKILL.md，不发送附件；每个结果都独立缓存，且不会自动应用。"
      size="large"
      footer={(
        <>
          <span className="footer-note">{running ? `进度 ${progress.completed + progress.failed} / ${readyCount}` : `确认 ${readyCount} 个文件 · ${formatBytes(totalBytes)}`}</span>
          {running
            ? <button type="button" className="button danger" onClick={() => void cancel()}>停止后续请求</button>
            : <button type="button" className="button" onClick={() => onOpenChange(false)}>返回</button>}
          <button type="button" className="button primary" disabled={loading || running || !providerId || readyCount === 0} onClick={() => void run()}>
            {running ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
            确认分析 {readyCount} 个
          </button>
        </>
      )}
    >
      <div className="batch-ai-header">
        <div><FileLock2 size={18} /><span>脚本、二进制和 references 附件不会进入本次批量请求。</span></div>
        <label><span>服务</span><select value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select></label>
      </div>
      <div className="batch-ai-list">
        {loading && <div className="batch-loading"><LoaderCircle className="spin" size={18} />正在生成每个 Skill 的发送清单…</div>}
        {!loading && items.map((item) => (
          <div className="batch-ai-row" key={item.skill.id}>
            <span className={`host-mark host-${item.skill.host}`}>{item.skill.host.slice(0, 2).toUpperCase()}</span>
            <div><strong>{item.skill.displayName}</strong><code>{item.skill.path}</code></div>
            {item.error ? <em className="batch-error"><TriangleAlert size={13} />{item.error}</em> : <span>{formatBytes(item.preview?.mainFileBytes ?? 0)} · SKILL.md</span>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
