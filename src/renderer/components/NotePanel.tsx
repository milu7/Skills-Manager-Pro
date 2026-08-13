import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { ImagePlus, LoaderCircle, NotebookPen, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { SkillDetails, SkillNote, SkillNoteImage } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { formatBytes } from './common';
import { useTranslation } from 'react-i18next';
import { activeLocale } from '../i18n';

const IMAGE_MARKER = /skill-note-image:([0-9a-f-]{36})/gi;
const NOTE_EDITOR_EXTENSIONS = [markdown(), EditorView.lineWrapping];

export function NotePanel({ skill }: { skill: SkillDetails }) {
  const { t } = useTranslation();
  const [note, setNote] = useState<SkillNote | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const notify = useWorkbenchStore((state) => state.notify);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void window.workbench.notes.get(skill.id).then((value) => {
      if (!active) return;
      setNote(value);
      setBody(value.body);
    }).catch((error) => {
      if (active) notify('error', readableError(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [skill.id, notify]);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await window.workbench.notes.save({ skillId: skill.id, body });
      setNote(saved);
      setBody(saved.body);
      notify('success', t('workbench:notes.saved'));
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const insertImage = async () => {
    setBusy(true);
    try {
      const image = await window.workbench.notes.addImage(skill.id);
      if (!image) return;
      const separator = body.trim() ? '\n\n' : '';
      const nextBody = `${body}${separator}![${markdownAlt(image.filename, t('workbench:notes.defaultImageAlt'))}](skill-note-image:${image.id})\n`;
      const saved = await window.workbench.notes.save({ skillId: skill.id, body: nextBody });
      setNote(saved);
      setBody(saved.body);
      notify('success', t('workbench:notes.imageInserted'));
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const removeImage = async (image: SkillNoteImage) => {
    setBusy(true);
    try {
      await window.workbench.notes.save({ skillId: skill.id, body });
      const updated = await window.workbench.notes.removeImage(skill.id, image.id);
      setNote(updated);
      setBody(updated.body);
      notify('success', t('workbench:notes.imageRemoved', { name: image.filename }));
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const previewBody = useMemo(() => body.replace(IMAGE_MARKER, (_match, id: string) => `https://skill-note.local/${id}`), [body]);

  if (loading) return <div className="center-loader"><LoaderCircle className="spin" /></div>;

  return (
    <div className="note-panel">
      <header className="note-header">
        <div><span className="eyebrow">{t('workbench:notes.eyebrow')}</span><h3>{t('workbench:notes.title')}</h3><p>{t('workbench:notes.help')}</p></div>
        <div className="note-actions">
          <button className="button secondary compact" type="button" disabled={busy} onClick={() => void insertImage()}><ImagePlus size={15} />{t('workbench:notes.addImage')}</button>
          <button className="button primary compact" type="button" disabled={busy || body === (note?.body ?? '')} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{t('workbench:notes.save')}</button>
        </div>
      </header>
      <div className="note-workspace">
        <section className="note-editor">
          <div className="note-pane-title"><NotebookPen size={15} /><strong>{t('workbench:notes.content')}</strong><span>{t('workbench:notes.markdown')}</span></div>
          <CodeMirror value={body} height="100%" extensions={NOTE_EDITOR_EXTENSIONS} onChange={setBody} placeholder={t('workbench:notes.placeholder')} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }} />
        </section>
        <section className="note-preview-pane">
          <div className="note-pane-title"><strong>{t('workbench:notes.preview')}</strong><span>{t('workbench:notes.characters', { count: body.length.toLocaleString(activeLocale()) })}</span></div>
          <article className="markdown-preview note-preview">
            {body.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  img: ({ src, alt, title }) => <NoteImage src={src} alt={alt} title={title} images={note?.images ?? []} />,
                  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>
                }}
              >{previewBody}</ReactMarkdown>
            ) : <p className="note-empty">{t('workbench:notes.previewEmpty')}</p>}
          </article>
        </section>
      </div>
      {Boolean(note?.images.length) && (
        <section className="note-attachments">
          <header><strong>{t('workbench:notes.images')}</strong><span>{t('workbench:notes.imageCount', { count: note?.images.length })}</span></header>
          <div>{note?.images.map((image) => (
            <figure key={image.id}>
              <img src={image.dataUrl} alt={image.filename} />
              <figcaption><span title={image.filename}>{image.filename}</span><small>{formatBytes(image.sizeBytes)}</small></figcaption>
              <button type="button" aria-label={t('workbench:notes.removeImage', { name: image.filename })} disabled={busy} onClick={() => void removeImage(image)}><Trash2 size={14} /></button>
            </figure>
          ))}</div>
        </section>
      )}
    </div>
  );
}

function NoteImage({ src, alt, title, images }: { src?: string; alt?: string; title?: string; images: SkillNoteImage[] }) {
  const { t } = useTranslation();
  const id = src?.match(/^https:\/\/skill-note\.local\/([0-9a-f-]{36})$/i)?.[1];
  const image = images.find((item) => item.id === id);
  if (!image) return <span className="note-image-missing">{t('workbench:notes.imageUnavailable', { name: alt || t('workbench:notes.unnamedImage') })}</span>;
  return <img src={image.dataUrl} alt={alt || image.filename} title={title} loading="lazy" />;
}

function markdownAlt(value: string, fallback: string): string {
  return value.replace(/[\[\]\\]/g, '').trim() || fallback;
}
