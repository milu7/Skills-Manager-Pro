import { AlertCircle, Binary, Boxes, CheckCircle2, Copy, FileCode2, FileText, Info, Link2Off, Save, Tags, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import type { SkillDetails, SkillDiagnostic } from '../../shared/types';
import { HOST_LABELS, SKILL_CATEGORIES, SOURCE_LABELS } from '../../shared/constants';
import { readableError, useWorkbenchStore } from '../store';
import { StatusPill, formatBytes, formatDate } from './common';

export function OverviewPanel({ skill }: { skill: SkillDetails }) {
  const [category, setCategory] = useState(skill.category);
  const [tags, setTags] = useState(skill.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const notify = useWorkbenchStore((state) => state.notify);
  const refreshDetails = useWorkbenchStore((state) => state.refreshDetails);
  const setFilters = useWorkbenchStore((state) => state.setFilters);

  useEffect(() => { setCategory(skill.category); setTags(skill.tags.join(', ')); }, [skill.id, skill.category, skill.tags]);

  const saveOrganization = async () => {
    setSaving(true);
    try {
      const result = await window.workbench.skills.updateOrganization({
        skillId: skill.id,
        category,
        tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
      });
      notify('success', result.message);
      await refreshDetails();
    } catch (error) { notify('error', readableError(error)); }
    finally { setSaving(false); }
  };

  return (
    <div className="tab-scroll overview-panel">
      <section className="metric-strip">
        <Metric label="文件" value={String(skill.fileCount)} icon={<FileText size={15} />} />
        <Metric label="体积" value={formatBytes(skill.sizeBytes)} icon={<Boxes size={15} />} />
        <Metric label="正文" value={`${skill.lineCount} 行`} icon={<FileCode2 size={15} />} />
        <Metric label="更新" value={formatDate(skill.updatedAt)} icon={<CheckCircle2 size={15} />} />
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">身份信息</span><h3>身份与来源</h3></div></div>
        <dl className="identity-grid">
          <div><dt>显示名</dt><dd>{skill.displayName}</dd></div>
          <div><dt>内部名称</dt><dd><code>{skill.name}</code></dd></div>
          <div><dt>宿主</dt><dd>{HOST_LABELS[skill.host]}</dd></div>
          <div><dt>来源</dt><dd>{SOURCE_LABELS[skill.sourceType]} · {skill.scope}</dd></div>
          <div><dt>主内容哈希</dt><dd><code>{skill.contentHash.slice(0, 12)}</code></dd></div>
          <div><dt>权限</dt><dd>{skill.writable ? '原地可写' : '受保护只读'}</dd></div>
        </dl>
        {skill.parentPlugin && <div className="plugin-line">父插件 <code>{skill.parentPlugin}</code></div>}
        {skill.family && (
          <div className="family-line">
            <Copy size={14} />
            <span>Skill 家族 <b>{skill.family.installationIds.length}</b> 个安装 · {skill.family.hosts.map((host) => HOST_LABELS[host]).join(' / ')}</span>
            <StatusPill tone={skill.family.mergeAssessment === 'exact_content' ? 'green' : 'amber'}>{skill.family.mergeAssessment === 'exact_content' ? '内容相同' : '需人工判断'}</StatusPill>
          </div>
        )}
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">分类管理</span><h3>分类与标签</h3></div>{skill.suggestedCategory !== skill.category && <button className="suggestion-chip" type="button" onClick={() => setCategory(skill.suggestedCategory)}>本地建议：{skill.suggestedCategory}</button>}</div>
        <div className="organization-help"><Info size={15} /><span>仅用于工作台内筛选和整理；保存后不会移动 Skill、修改目录或影响宿主调用。</span></div>
        <div className="organization-row">
          <label><span>主分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{SKILL_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="tag-input"><span>自定义标签</span><div><Tags size={15} /><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="逗号分隔" /></div></label>
          <button className="button compact primary" type="button" disabled={saving || (category === skill.category && tags === skill.tags.join(', '))} onClick={() => void saveOrganization()}><Save size={14} />保存</button>
        </div>
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">安全检查</span><h3>本地检查</h3></div><HealthSummary skill={skill} /></div>
        {skill.diagnostics.length === 0 ? <div className="clean-audit"><CheckCircle2 size={18} /><div><strong>未发现结构问题</strong><p>仍建议在真实宿主中验证触发与资源引用。</p></div></div> : (
          <div className="diagnostic-list">{skill.diagnostics.map((diagnostic, index) => <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />)}</div>
        )}
        {skill.duplicateKind && (
          <button className="duplicate-callout" type="button" onClick={() => void setFilters({ duplicateOnly: true }, true)}>
            <Copy size={17} /><div><strong>{skill.duplicateKind === 'exact' ? '发现精确重复' : skill.duplicateKind === 'near' ? '发现近似重复' : '发现同名副本'}</strong><span>组 {skill.duplicateGroup} · 查看全部重复项</span></div>
          </button>
        )}
      </section>

      <section className="overview-section markdown-section">
        <div className="section-title"><div><span className="eyebrow">内容预览</span><h3>说明预览</h3></div></div>
        <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>{skill.body || '*暂无正文*'}</ReactMarkdown></article>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="metric"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function HealthSummary({ skill }: { skill: SkillDetails }) {
  if (skill.health === 'error') return <StatusPill tone="red">{skill.diagnostics.filter((item) => item.severity === 'error').length} 个错误</StatusPill>;
  if (skill.health === 'warning') return <StatusPill tone="amber">{skill.diagnostics.filter((item) => item.severity === 'warning').length} 项需检查</StatusPill>;
  return <StatusPill tone="green">结构健康</StatusPill>;
}

function DiagnosticRow({ diagnostic }: { diagnostic: SkillDiagnostic }) {
  const Icon = diagnostic.code.includes('link') ? Link2Off : diagnostic.code.includes('binary') ? Binary : diagnostic.severity === 'error' ? AlertCircle : diagnostic.severity === 'warning' ? TriangleAlert : Info;
  return <div className={clsx('diagnostic-row', `diagnostic-${diagnostic.severity}`)}><Icon size={17} /><div><strong>{diagnostic.title}</strong><p>{diagnostic.message}</p>{diagnostic.relativePath && <code>{diagnostic.relativePath}</code>}</div></div>;
}
