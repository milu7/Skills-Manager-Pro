import { ArrowRight, Clock3, FileClock, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActionLog } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { DiffView } from './DiffView';
import { EmptyState, StatusPill, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import { localizedAction } from '../i18n';
import type { TFunction } from 'i18next';

export function HistoryPanel() {
  const { t } = useTranslation();
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
      <header className="wide-header"><div><span className="eyebrow">{t('workbench:history.eyebrow')}</span><h1>{t('workbench:history.title')}</h1><p>{t('workbench:history.subtitle')}</p></div><StatusPill tone="blue">{t('workbench:history.count', { count: actions.length })}</StatusPill></header>
      <div className="history-layout">
        <div className="history-list">
          {actions.map((action) => <button type="button" key={action.id} className={selected?.id === action.id ? 'is-active' : ''} onClick={() => void select(action)}><span className="history-icon"><FileClock size={16} /></span><div><strong>{localizedAction(t, action)}</strong><p>{action.path}</p><small>{formatDate(action.createdAt)} · {actionLabel(t, action.action)}</small></div>{action.reversible && <RotateCcw size={13} />}</button>)}
          {!busy && actions.length === 0 && <EmptyState icon={<Clock3 size={23} />} title={t('workbench:history.emptyTitle')} detail={t('workbench:history.emptyDetail')} />}
        </div>
        <section className="history-detail">
          {busy && !selected ? <div className="center-loader"><LoaderCircle className="spin" /></div> : selected ? <><header><div><span className="eyebrow">{t('workbench:history.change')}</span><h2>{localizedAction(t, selected)}</h2><p>{selected.path}</p></div>{selected.reversible && selected.snapshotId && <button className="button secondary" disabled={busy} onClick={() => void restore()}><RotateCcw size={14} />{t('workbench:history.restore')}</button>}</header><div className="hash-comparison"><code>{selected.beforeHash?.slice(0, 12) ?? '—'}</code><ArrowRight size={14} /><code>{selected.afterHash?.slice(0, 12) ?? '—'}</code></div>{diff && (diff.before || diff.after) ? <><h4 className="diff-file-label">{diff.relativePath || t('workbench:history.fileOperation')}</h4><DiffView before={diff.before} after={diff.after} /></> : <EmptyState title={t('workbench:history.noDiffTitle')} detail={t('workbench:history.noDiffDetail')} />}</> : null}
        </section>
      </div>
    </main>
  );
}

function actionLabel(t: TFunction, action: ActionLog['action']): string {
  return t(`messages:action.${action}`);
}
