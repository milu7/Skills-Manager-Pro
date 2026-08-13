import { Folder, FolderPlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { SkillRoot } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { IconButton, Modal, StatusPill, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import { translatedHost, translatedSource } from '../i18n';

export function RootManager({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { t } = useTranslation();
  const roots = useWorkbenchStore((state) => state.roots);
  const updateRoots = useWorkbenchStore((state) => state.updateRoots);
  const notify = useWorkbenchStore((state) => state.notify);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try { const next = await window.workbench.roots.pickAndAdd(); updateRoots(next); notify('success', t('workbench:roots.added')); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const remove = async (root: SkillRoot) => {
    setBusy(true);
    try { const next = await window.workbench.roots.remove(root.id); updateRoots(next); notify('success', t('workbench:roots.removed', { label: localizedRootLabel(t, root) })); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('workbench:roots.title')} description={t('workbench:roots.detail')} size="large" footer={<><span className="footer-note">{t('workbench:roots.footer')}</span><button className="button primary" disabled={busy} onClick={() => void add()}>{busy ? <LoaderCircle className="spin" size={15} /> : <FolderPlus size={15} />}{t('workbench:roots.add')}</button></>}>
      <div className="root-list">
        {roots.map((root) => (
          <div className="root-row" key={root.id}>
            <div className={`root-icon root-${root.host}`}><Folder size={18} /></div>
            <div className="root-main"><div><strong>{localizedRootLabel(t, root)}</strong>{root.discovered && <StatusPill tone="blue">{t('workbench:roots.discovered')}</StatusPill>}{!root.writable && <StatusPill>{t('status.readOnly')}</StatusPill>}</div><p>{root.path}</p><span>{t('workbench:roots.lastScan', { host: translatedHost(t, root.host), source: translatedSource(t, root.sourceType), date: formatDate(root.lastScannedAt) })}</span></div>
            <b className="root-count">{root.skillCount}<small>Skills</small></b>
            <IconButton label={t('workbench:roots.open')} onClick={() => void window.workbench.app.openPath(root.path)}><Folder size={16} /></IconButton>
            {!root.discovered && root.sourceType !== 'trash' && <IconButton label={t('workbench:roots.remove')} onClick={() => void remove(root)} disabled={busy}><Trash2 size={16} /></IconButton>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function localizedRootLabel(t: ReturnType<typeof useTranslation>['t'], root: SkillRoot): string {
  return root.labelCode ? t(`workbench:roots.label.${root.labelCode}`, { defaultValue: root.label }) : root.label;
}
