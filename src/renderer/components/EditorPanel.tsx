import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { AlertTriangle, Braces, FileText, FolderTree, LoaderCircle, LockKeyhole, PencilLine, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { SkillDetails, SkillTextFile } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { DiffView } from './DiffView';
import { EmptyState, Modal, formatBytes } from './common';
import { useTranslation } from 'react-i18next';
import { activeLocale } from '../i18n';

type EditorMode = 'metadata' | 'body' | 'resources';

interface PendingSave {
  title: string;
  relativePath: string;
  before: string;
  after: string;
  execute(): Promise<void>;
}

export function EditorPanel({ skill, onRename }: { skill: SkillDetails; onRename(mode: 'display' | 'internal'): void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditorMode>('metadata');
  const [description, setDescription] = useState(skill.description);
  const [body, setBody] = useState(skill.body);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [file, setFile] = useState<SkillTextFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [saving, setSaving] = useState(false);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshList = useWorkbenchStore((state) => state.refreshList);

  useEffect(() => {
    setDescription(skill.description);
    setBody(skill.body);
    setSelectedFile(null);
    setFile(null);
    setPending(null);
  }, [skill.id, skill.mainFileHash, skill.description, skill.body]);

  const openFile = async (relativePath: string) => {
    setSelectedFile(relativePath);
    setLoadingFile(true);
    try {
      const value = await window.workbench.skills.readText(skill.id, relativePath);
      setFile(value); setFileContent(value.content);
    } catch (error) { notify('error', readableError(error)); setFile(null); }
    finally { setLoadingFile(false); }
  };

  const executePending = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await pending.execute();
      notify('success', t('workbench:editor.saved'));
      setPending(null);
      await refreshList(skill.id);
    } catch (error) { notify('error', readableError(error)); }
    finally { setSaving(false); }
  };

  if (!skill.writable) {
    return <div className="tab-scroll editor-readonly"><EmptyState icon={<LockKeyhole size={23} />} title={t('workbench:editor.protectedTitle')} detail={t('workbench:editor.protectedDetail')} /><ReadOnlyFileBrowser skill={skill} onOpen={(path) => { setMode('resources'); void openFile(path); }} /></div>;
  }

  const previewDescription = () => {
    const before = skill.description;
    setPending({
      title: t('workbench:editor.confirmDescription'), relativePath: 'SKILL.md', before, after: description,
      execute: async () => { await window.workbench.skills.updateMetadata({ skillId: skill.id, description, expectedHash: skill.mainFileHash }); }
    });
  };
  const previewBody = () => setPending({
    title: t('workbench:editor.confirmBody'), relativePath: 'SKILL.md · body', before: skill.body, after: body,
    execute: async () => { await window.workbench.skills.updateBody({ skillId: skill.id, body, expectedHash: skill.mainFileHash }); }
  });
  const previewFile = () => {
    if (!file) return;
    setPending({
      title: t('workbench:editor.confirmFile', { file: file.relativePath }), relativePath: file.relativePath, before: file.content, after: fileContent,
      execute: async () => { await window.workbench.skills.writeText({ skillId: skill.id, relativePath: file.relativePath, content: fileContent, expectedHash: file.contentHash }); }
    });
  };

  return (
    <div className="editor-layout">
      <div className="editor-modebar">
        <button type="button" className={mode === 'metadata' ? 'is-active' : ''} onClick={() => setMode('metadata')}><Braces size={15} />{t('workbench:editor.metadata')}</button>
        <button type="button" className={mode === 'body' ? 'is-active' : ''} onClick={() => setMode('body')}><FileText size={15} />{t('workbench:editor.markdown')}</button>
        <button type="button" className={mode === 'resources' ? 'is-active' : ''} onClick={() => setMode('resources')}><FolderTree size={15} />{t('workbench:editor.resources')}</button>
      </div>
      {mode === 'metadata' && (
        <div className="editor-content metadata-editor">
          <div className="editor-intro"><span className="eyebrow">{t('workbench:editor.safety')}</span><h3>{t('workbench:editor.metadata')}</h3><p>{t('workbench:editor.metadataHelp')}</p></div>
          <div className="dual-name-card">
            <div><span>{t('workbench:editor.displayName')}</span><strong>{skill.displayName}</strong><button type="button" onClick={() => onRename('display')}><PencilLine size={13} />{t('workbench:editor.change')}</button></div>
            <div><span>{t('workbench:editor.internalName')}</span><code>{skill.name}</code><button type="button" onClick={() => onRename('internal')}><PencilLine size={13} />{t('workbench:editor.previewRename')}</button></div>
          </div>
          <label className="field"><span className="field-label">{t('workbench:editor.description')}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} placeholder={t('workbench:editor.descriptionPlaceholder')} /><small>{description.length.toLocaleString(activeLocale())} / 8,000</small></label>
          <div className="editor-footer"><span><AlertTriangle size={14} />{t('workbench:editor.hashHelp')}</span><button className="button primary" type="button" disabled={!description.trim() || description === skill.description} onClick={previewDescription}><Save size={15} />{t('workbench:editor.previewSave')}</button></div>
        </div>
      )}
      {mode === 'body' && (
        <div className="editor-content code-editor-content">
          <div className="code-toolbar"><div><strong>SKILL.md</strong><span>{t('workbench:editor.bodyArea')}</span></div><button className="button primary compact" type="button" disabled={body === skill.body} onClick={previewBody}><Save size={14} />{t('workbench:editor.previewSave')}</button></div>
          <CodeMirror value={body} height="100%" extensions={[markdown()]} onChange={setBody} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} />
        </div>
      )}
      {mode === 'resources' && (
        <div className="resource-editor">
          <ResourceList skill={skill} selected={selectedFile} onSelect={(path) => void openFile(path)} />
          <div className="resource-code">
            {loadingFile ? <div className="center-loader"><LoaderCircle className="spin" /></div> : file ? (
              <>
                <div className="code-toolbar"><div><strong>{file.relativePath}</strong><span>{formatBytes(new TextEncoder().encode(file.content).length)} · {file.newline.toUpperCase()} {file.hasBom ? '· BOM' : ''}</span></div><button className="button primary compact" type="button" disabled={!file.editable || fileContent === file.content} onClick={previewFile}><Save size={14} />{t('workbench:editor.previewSave')}</button></div>
                {!file.editable && <div className="readonly-ribbon"><LockKeyhole size={14} />{t('workbench:editor.readOnlyRibbon')}</div>}
                <CodeMirror value={fileContent} height="100%" readOnly={!file.editable} extensions={extensionsFor(file.language)} onChange={setFileContent} />
              </>
            ) : <EmptyState title={t('workbench:editor.selectResource')} detail={t('workbench:editor.selectResourceHelp')} />}
          </div>
        </div>
      )}
      {pending && <Modal open onOpenChange={(open) => !open && setPending(null)} title={pending.title} description={t('workbench:editor.validateHash', { file: pending.relativePath })} size="wide" footer={<><button className="button secondary" onClick={() => setPending(null)}>{t('workbench:editor.backEdit')}</button><button className="button primary" disabled={saving} onClick={() => void executePending()}>{saving && <LoaderCircle className="spin" size={15} />}{t('workbench:editor.confirmSave')}</button></>}><DiffView before={pending.before} after={pending.after} /></Modal>}
    </div>
  );
}

function ResourceList({ skill, selected, onSelect }: { skill: SkillDetails; selected: string | null; onSelect(path: string): void }) {
  const { t } = useTranslation();
  return <div className="resource-list"><header><span>{t('workbench:editor.textResources')}</span><b>{skill.files.filter((file) => file.text).length}</b></header>{skill.files.filter((file) => file.text).map((file) => <button key={file.relativePath} type="button" className={clsx(selected === file.relativePath && 'is-active')} onClick={() => onSelect(file.relativePath)}><FileText size={14} /><span>{file.relativePath}</span>{!file.editable && <LockKeyhole size={11} />}</button>)}</div>;
}

function ReadOnlyFileBrowser({ skill, onOpen }: { skill: SkillDetails; onOpen(path: string): void }) {
  const { t } = useTranslation();
  return <div className="readonly-browser"><h3>{t('workbench:editor.viewableResources')}</h3>{skill.files.filter((file) => file.text).map((file) => <button key={file.relativePath} type="button" onClick={() => onOpen(file.relativePath)}><FileText size={14} />{file.relativePath}<span>{formatBytes(file.sizeBytes)}</span></button>)}</div>;
}

function extensionsFor(language: SkillTextFile['language']) {
  if (language === 'markdown') return [markdown()];
  if (language === 'yaml') return [yaml()];
  return [];
}
