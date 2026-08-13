import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { Binary, File, FileCode2, FileImage, FileText, FolderOpen, LoaderCircle, LockKeyhole, Paperclip } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { SkillDetails, SkillFileEntry, SkillTextFile } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { EmptyState, IconButton, Modal, formatBytes, formatDate } from './common';

export function FilesPanel({ skill }: { skill: SkillDetails }) {
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
      <div className="files-summary"><div><span className="eyebrow">文件清单</span><h3>{skill.fileCount} 个文件 · {formatBytes(skill.sizeBytes)}</h3></div><button className="button compact secondary" type="button" onClick={() => void window.workbench.app.openPath(skill.path)}><FolderOpen size={14} />打开目录</button></div>
      <div className="file-table" role="table">
        <div className="file-table-head" role="row"><span>文件</span><span>类型</span><span>大小</span><span>更新时间</span><span /></div>
        {skill.files.map((entry) => (
          <button key={entry.relativePath} type="button" role="row" className={clsx(!entry.text && 'is-binary')} disabled={!entry.text} onClick={() => void open(entry)}>
            <span className="file-name">{fileIcon(entry)}<code>{entry.relativePath}</code></span>
            <span>{kindLabel(entry.kind)}</span><span>{formatBytes(entry.sizeBytes)}</span><span>{formatDate(entry.modifiedAt)}</span><span>{entry.editable ? '可编辑' : <LockKeyhole size={12} />}</span>
          </button>
        ))}
      </div>
      {loading && <div className="file-loading"><LoaderCircle className="spin" /></div>}
      {viewer && <Modal open onOpenChange={(open) => !open && setViewer(null)} title={viewer.relativePath} description={`${viewer.newline.toUpperCase()}${viewer.hasBom ? ' · UTF-8 BOM' : ' · UTF-8'} · ${viewer.editable ? '可在编辑页修改' : '只读'}`} size="wide"><div className="file-viewer"><CodeMirror value={viewer.content} readOnly height="64vh" extensions={viewer.language === 'markdown' ? [markdown()] : viewer.language === 'yaml' ? [yaml()] : []} /></div></Modal>}
      {skill.files.length === 0 && <EmptyState title="没有已索引文件" detail="重新扫描后再试。" />}
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

function kindLabel(kind: SkillFileEntry['kind']) {
  return { main: '主说明', metadata: '宿主元数据', reference: '参考资料', asset: '资源', script: '脚本', other: '其他' }[kind];
}
