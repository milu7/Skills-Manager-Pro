import { Folder, FolderPlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { HOST_LABELS, SOURCE_LABELS } from '../../shared/constants';
import type { SkillRoot } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { IconButton, Modal, StatusPill, formatDate } from './common';

export function RootManager({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const roots = useWorkbenchStore((state) => state.roots);
  const updateRoots = useWorkbenchStore((state) => state.updateRoots);
  const notify = useWorkbenchStore((state) => state.notify);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try { const next = await window.workbench.roots.pickAndAdd(); updateRoots(next); notify('success', '项目根目录已添加，后台扫描已开始'); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const remove = async (root: SkillRoot) => {
    setBusy(true);
    try { const next = await window.workbench.roots.remove(root.id); updateRoots(next); notify('success', `已移除扫描配置：${root.label}`); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="扫描目录" description="原地索引这些目录；添加项目根不会迁移或修改其中的 Skill。" size="large" footer={<><span className="footer-note">项目扫描会排除 node_modules、.git、会话缓存和备份。</span><button className="button primary" disabled={busy} onClick={() => void add()}>{busy ? <LoaderCircle className="spin" size={15} /> : <FolderPlus size={15} />}添加项目根目录</button></>}>
      <div className="root-list">
        {roots.map((root) => (
          <div className="root-row" key={root.id}>
            <div className={`root-icon root-${root.host}`}><Folder size={18} /></div>
            <div className="root-main"><div><strong>{root.label}</strong>{root.discovered && <StatusPill tone="blue">自动发现</StatusPill>}{!root.writable && <StatusPill>只读</StatusPill>}</div><p>{root.path}</p><span>{HOST_LABELS[root.host]} · {SOURCE_LABELS[root.sourceType]} · 上次扫描 {formatDate(root.lastScannedAt)}</span></div>
            <b className="root-count">{root.skillCount}<small>Skills</small></b>
            <IconButton label="在资源管理器中打开" onClick={() => void window.workbench.app.openPath(root.path)}><Folder size={16} /></IconButton>
            {!root.discovered && root.sourceType !== 'trash' && <IconButton label="移除扫描配置" onClick={() => void remove(root)} disabled={busy}><Trash2 size={16} /></IconButton>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
