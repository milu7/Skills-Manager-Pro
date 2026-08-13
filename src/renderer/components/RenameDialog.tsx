import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import type { RenamePreview, SkillDetails } from '../../shared/types';
import { readableError, useWorkbenchStore } from '../store';
import { DiffView } from './DiffView';
import { Field, Modal } from './common';

export function RenameDialog({
  open,
  onOpenChange,
  skill,
  mode
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  skill: SkillDetails;
  mode: 'display' | 'internal';
}) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<RenamePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshList = useWorkbenchStore((state) => state.refreshList);

  useEffect(() => {
    if (!open) return;
    setName(mode === 'display' ? skill.displayName : skill.name);
    setPreview(null);
  }, [open, mode, skill.displayName, skill.name]);

  const loadPreview = async () => {
    setBusy(true);
    try {
      const input = { skillId: skill.id, newName: name.trim(), expectedHash: skill.mainFileHash };
      setPreview(mode === 'display'
        ? await window.workbench.skills.previewRenameDisplay(input)
        : await window.workbench.skills.previewRenameInternal(input));
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const input = { skillId: skill.id, newName: name.trim(), expectedHash: skill.mainFileHash };
      const result = mode === 'display'
        ? await window.workbench.skills.renameDisplay(input)
        : await window.workbench.skills.renameInternal(input);
      notify('success', result.message);
      onOpenChange(false);
      await refreshList(skill.id);
    } catch (error) { notify('error', readableError(error)); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={mode === 'display' ? '修改显示名' : '修改内部名称'}
      description={mode === 'display' ? '只改变用户看到的标题；宿主不支持时保存为工作台别名。' : '会同步检查目录、已知调用名称、Codex UI 元数据和自引用。'}
      footer={<><button className="button secondary" type="button" onClick={() => onOpenChange(false)}>取消</button>{preview ? <button className="button primary" type="button" disabled={busy} onClick={() => void confirm()}>{busy && <LoaderCircle className="spin" size={15} />}确认执行</button> : <button className="button primary" type="button" disabled={busy || !name.trim()} onClick={() => void loadPreview()}>{busy && <LoaderCircle className="spin" size={15} />}预检差异</button>}</>}
    >
      <div className="rename-line">
        <span>{mode === 'display' ? skill.displayName : skill.name}</span><ArrowRight size={18} /><input value={name} onChange={(event) => { setName(event.target.value); setPreview(null); }} autoFocus />
      </div>
      {preview && (
        <div className="rename-preview">
          {preview.targetPath && <Field label="目标目录"><div className="path-box">{preview.targetPath}</div></Field>}
          {preview.warnings.map((warning) => <div className="inline-warning" key={warning}>{warning}</div>)}
          {preview.changes.length === 0 ? <div className="alias-preview">不会修改文件；仅更新工作台本地别名。</div> : preview.changes.map((change) => (
            <section key={change.relativePath} className="diff-section"><h4>{change.relativePath}</h4><DiffView before={change.before} after={change.after} /></section>
          ))}
        </div>
      )}
    </Modal>
  );
}
