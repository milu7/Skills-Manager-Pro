import { ArrowRight, Clock3, FileClock, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActionLog } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { DiffView } from './DiffView';
import { EmptyState, StatusPill, formatDate } from './common';

export function HistoryPanel() {
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [selected, setSelected] = useState<ActionLog | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string; relativePath: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshList = useWorkbenchStore((state) => state.refreshList);

  const load = async () => {
    setBusy(true);
    try {
      const values = await window.workbench.history.list(250);
      setActions(values);
      const first = values[0] ?? null;
      setSelected(first);
      setDiff(first ? await window.workbench.history.showDiff(first.id) : null);
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const select = async (action: ActionLog) => {
    setSelected(action); setBusy(true);
    try { setDiff(await window.workbench.history.showDiff(action.id)); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!selected?.snapshotId) return;
    setBusy(true);
    try { const result = await window.workbench.history.restore(selected.snapshotId); notify('success', result.message); await refreshList(result.skillId); await load(); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <main className="wide-panel history-page">
      <header className="wide-header"><div><span className="eyebrow">操作审计</span><h1>操作历史</h1><p>文本编辑前会保存快照；改名、回收和 AI 分析保留独立记录。</p></div><StatusPill tone="blue">{actions.length} 条记录</StatusPill></header>
      <div className="history-layout">
        <div className="history-list">
          {actions.map((action) => <button type="button" key={action.id} className={selected?.id === action.id ? 'is-active' : ''} onClick={() => void select(action)}><span className="history-icon"><FileClock size={16} /></span><div><strong>{action.summary}</strong><p>{action.path}</p><small>{formatDate(action.createdAt)} · {actionLabel(action.action)}</small></div>{action.reversible && <RotateCcw size={13} />}</button>)}
          {!busy && actions.length === 0 && <EmptyState icon={<Clock3 size={23} />} title="还没有操作记录" detail="首次编辑、改名或分析后会出现在这里。" />}
        </div>
        <section className="history-detail">
          {busy && !selected ? <div className="center-loader"><LoaderCircle className="spin" /></div> : selected ? <><header><div><span className="eyebrow">修改内容</span><h2>{selected.summary}</h2><p>{selected.path}</p></div>{selected.reversible && selected.snapshotId && <button className="button secondary" disabled={busy} onClick={() => void restore()}><RotateCcw size={14} />恢复此前快照</button>}</header><div className="hash-comparison"><code>{selected.beforeHash?.slice(0, 12) ?? '—'}</code><ArrowRight size={14} /><code>{selected.afterHash?.slice(0, 12) ?? '—'}</code></div>{diff && (diff.before || diff.after) ? <><h4 className="diff-file-label">{diff.relativePath || '文件操作'}</h4><DiffView before={diff.before} after={diff.after} /></> : <EmptyState title="此操作没有文本差异" detail="目录移动、分类、回收或 AI 分析以操作元数据记录。" />}</> : null}
        </section>
      </div>
    </main>
  );
}

function actionLabel(action: ActionLog['action']): string {
  return { edit_metadata: '元数据', edit_body: '正文', edit_file: '资源文件', rename_display: '显示名', rename_internal: '内部改名', trash: '回收', restore: '恢复', restore_snapshot: '快照恢复', organize: '分类标签', ai_analyze: 'AI 分析' }[action];
}
