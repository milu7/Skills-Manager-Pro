import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { Binary, File, FileCode2, FileImage, FileText, FolderOpen, LoaderCircle, LockKeyhole, Paperclip } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { SkillDetails, SkillFileEntry, SkillTextFile } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { EmptyState, IconButton, Modal, formatBytes, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

export function FilesPanel({ skill }: { skill: SkillDetails }) {
  const { t } = useTranslation();
  const [viewer, setViewer] = useState<SkillTextFile | null>(null);
  const [loading, setLoading] = useState(false);
  const notify = useWorkbenchStore((state) => state.notify);

  const open = async (entry: SkillFileEntry) => {
    if (!entry.text) return;
    setLoading(true);
    try { setViewer(await window.workbench.skills.readText(skill.id, entry.relativePath)); }
    catch (error) { notify('error', readableError(error)); }
    finally { setLoading(false); }
  };

  return (
    <div className="tab-scroll files-panel">
      <div className="files-summary"><div><span className="eyebrow">{t('workbench:files.title')}</span><h3>{t('workbench:files.count', { count: skill.fileCount, size: formatBytes(skill.sizeBytes) })}</h3></div><button className="button compact secondary" type="button" onClick={() => void window.workbench.app.openPath(skill.path)}><FolderOpen size={14} />{t('workbench:files.openFolder')}</button></div>
      <div className="file-table" role="table">
        <div className="file-table-head" role="row"><span>{t('workbench:files.file')}</span><span>{t('workbench:files.type')}</span><span>{t('workbench:files.size')}</span><span>{t('workbench:files.updated')}</span><span /></div>
        {skill.files.map((entry) => (
          <button key={entry.relativePath} type="button" role="row" className={clsx(!entry.text && 'is-binary')} disabled={!entry.text} onClick={() => void open(entry)}>
            <span className="file-name">{fileIcon(entry)}<code>{entry.relativePath}</code></span>
            <span>{kindLabel(t, entry.kind)}</span><span>{formatBytes(entry.sizeBytes)}</span><span>{formatDate(entry.modifiedAt)}</span><span>{entry.editable ? t('status.editable') : <LockKeyhole size={12} />}</span>
          </button>
        ))}
      </div>
      {loading && <div className="file-loading"><LoaderCircle className="spin" /></div>}
      {viewer && <Modal open onOpenChange={(open) => !open && setViewer(null)} title={viewer.relativePath} description={`${viewer.newline.toUpperCase()}${viewer.hasBom ? ' · UTF-8 BOM' : ' · UTF-8'} · ${viewer.editable ? t('workbench:files.editInEditor') : t('status.readOnly')}`} size="wide"><div className="file-viewer"><CodeMirror value={viewer.content} readOnly height="64vh" extensions={viewer.language === 'markdown' ? [markdown()] : viewer.language === 'yaml' ? [yaml()] : []} /></div></Modal>}
      {skill.files.length === 0 && <EmptyState title={t('workbench:files.emptyTitle')} detail={t('workbench:files.emptyDetail')} />}
    </div>
  );
}

function fileIcon(entry: SkillFileEntry) {
  if (!entry.text) return <Binary size={15} />;
  if (entry.kind === 'main') return <FileText size={15} />;
  if (entry.kind === 'script') return <FileCode2 size={15} />;
  if (entry.kind === 'asset') return <FileImage size={15} />;
  if (entry.kind === 'reference') return <Paperclip size={15} />;
  return <File size={15} />;
}

function kindLabel(t: TFunction, kind: SkillFileEntry['kind']) {
  return t(`common:fileKind.${kind}`);
}
