import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import { ArchiveRestore, Bot, Code2, Files, FolderOpen, LoaderCircle, MoreHorizontal, NotebookPen, PencilLine, RefreshCw, ScanSearch, Trash2 } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { readableError, useWorkbenchStore } from '../store';
import { EmptyState, IconButton, Modal, StatusPill } from './common';
import { OverviewPanel } from './OverviewPanel';
import { EditorPanel } from './EditorPanel';
import { FilesPanel } from './FilesPanel';
import { AiPanel } from './AiPanel';
import { RenameDialog } from './RenameDialog';
import { NotePanel } from './NotePanel';

export function DetailPane() {
  const details = useWorkbenchStore((state) => state.details);
  const detailLoading = useWorkbenchStore((state) => state.detailLoading);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshList = useWorkbenchStore((state) => state.refreshList);
  const [renameMode, setRenameMode] = useState<'display' | 'internal' | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!details) return <aside className="detail-pane detail-empty"><EmptyState title="选择一个 Skill" detail="右侧会显示说明、诊断、文件与修改历史。" /></aside>;

  const localScan = async () => {
    setBusy(true);
    try { await window.workbench.analysis.runLocal(details.id); notify('success', '本地检查已更新'); await refreshList(details.id); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const trash = async () => {
    setBusy(true);
    try { const result = await window.workbench.skills.moveToTrash(details.id); notify('success', result.message); setTrashOpen(false); await refreshList(); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true);
    try { const result = await window.workbench.skills.restore(details.id); notify('success', result.message); await refreshList(details.id); }
    catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <aside className={clsx('detail-pane', detailLoading && 'is-loading')}>
      <header className="detail-header">
        <div className={`detail-monogram monogram-${details.host}`}>{monogram(details.displayName)}</div>
        <div className="detail-heading">
          <div className="detail-title-line"><h2>{details.displayName}</h2>{details.writable ? <StatusPill tone="green">可编辑</StatusPill> : <StatusPill tone={isProtectedReadOnly(details) ? 'red' : 'neutral'}>只读</StatusPill>}</div>
          <p>{details.path}</p>
        </div>
        <div className="detail-actions">
          <IconButton label="在资源管理器中打开" onClick={() => void window.workbench.app.openPath(details.path)}><FolderOpen size={17} /></IconButton>
          <IconButton label="重新检查" onClick={() => void localScan()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ScanSearch size={17} />}</IconButton>
          {details.state === 'trash' ? <button className="button compact" type="button" onClick={() => void restore()}><ArchiveRestore size={15} />恢复</button> : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><button className="icon-button" type="button" aria-label="更多操作"><MoreHorizontal size={18} /></button></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content className="dropdown-content" align="end" sideOffset={5}>
                <DropdownMenu.Item className="dropdown-item" disabled={!details.writable} onSelect={() => setRenameMode('display')}><PencilLine size={14} />修改显示名</DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" disabled={!details.writable} onSelect={() => setRenameMode('internal')}><Code2 size={14} />修改内部名称</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item className="dropdown-item danger" disabled={!details.writable} onSelect={() => setTrashOpen(true)}><Trash2 size={14} />移入回收站</DropdownMenu.Item>
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </header>
      <Tabs.Root className="detail-tabs" defaultValue="overview">
        <Tabs.List className="tabs-list" aria-label="Skill 详情">
          <Tabs.Trigger value="overview"><RefreshCw size={14} />概览</Tabs.Trigger>
          <Tabs.Trigger value="editor"><PencilLine size={14} />编辑</Tabs.Trigger>
          <Tabs.Trigger value="files"><Files size={14} />文件</Tabs.Trigger>
          <Tabs.Trigger value="notes"><NotebookPen size={14} />备注</Tabs.Trigger>
          <Tabs.Trigger value="ai"><Bot size={14} />AI 分析</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview"><OverviewPanel skill={details} /></Tabs.Content>
        <Tabs.Content value="editor"><EditorPanel skill={details} onRename={setRenameMode} /></Tabs.Content>
        <Tabs.Content value="files"><FilesPanel skill={details} /></Tabs.Content>
        <Tabs.Content value="notes"><NotePanel skill={details} /></Tabs.Content>
        <Tabs.Content value="ai"><AiPanel skill={details} /></Tabs.Content>
      </Tabs.Root>
      {renameMode && <RenameDialog open skill={details} mode={renameMode} onOpenChange={(open) => !open && setRenameMode(null)} />}
      <Modal open={trashOpen} onOpenChange={setTrashOpen} size="small" title="移入工作台回收站" description="不会永久删除，原路径和哈希会被记录，回收站也不会自动清空。" footer={<><button className="button secondary" onClick={() => setTrashOpen(false)}>取消</button><button className="button danger" disabled={busy} onClick={() => void trash()}>{busy && <LoaderCircle className="spin" size={15} />}确认移入</button></>}>
        <div className="destructive-summary"><Trash2 size={22} /><div><strong>{details.displayName}</strong><p>{details.path}</p></div></div>
      </Modal>
    </aside>
  );
}

function monogram(value: string): string { return value.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'SK'; }

function isProtectedReadOnly(skill: { writable: boolean; scope: string; sourceType: string }): boolean {
  return !skill.writable && (skill.scope === 'system' || ['builtin', 'plugin', 'marketplace', 'cache', 'backup'].includes(skill.sourceType));
}
