import { AlertCircle, Binary, Boxes, CheckCircle2, Copy, FileCode2, FileText, Info, Link2Off, Save, Tags, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import type { SkillDetails, SkillDiagnostic } from '../../shared/types';
import { SKILL_CATEGORIES } from '../../shared/constants';
import { readableError, useWorkbenchStore } from '../store';
import { StatusPill, formatBytes, formatDate } from './common';
import { useTranslation } from 'react-i18next';
import { localizedDiagnostic, translatedCategory, translatedHost, translatedScope, translatedSource } from '../i18n';

export function OverviewPanel({ skill }: { skill: SkillDetails }) {
  const { t } = useTranslation();
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
        <Metric label={t('workbench:overview.files')} value={String(skill.fileCount)} icon={<FileText size={15} />} />
        <Metric label={t('workbench:overview.size')} value={formatBytes(skill.sizeBytes)} icon={<Boxes size={15} />} />
        <Metric label={t('workbench:overview.body')} value={t('workbench:overview.lines', { count: skill.lineCount })} icon={<FileCode2 size={15} />} />
        <Metric label={t('workbench:overview.updated')} value={formatDate(skill.updatedAt)} icon={<CheckCircle2 size={15} />} />
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">{t('workbench:overview.identityEyebrow')}</span><h3>{t('workbench:overview.identity')}</h3></div></div>
        <dl className="identity-grid">
          <div><dt>{t('workbench:overview.displayName')}</dt><dd>{skill.displayName}</dd></div>
          <div><dt>{t('workbench:overview.internalName')}</dt><dd><code>{skill.name}</code></dd></div>
          <div><dt>{t('workbench:overview.host')}</dt><dd>{translatedHost(t, skill.host)}</dd></div>
          <div><dt>{t('workbench:overview.source')}</dt><dd>{translatedSource(t, skill.sourceType)} · {translatedScope(t, skill.scope)}</dd></div>
          <div><dt>{t('workbench:overview.hash')}</dt><dd><code>{skill.contentHash.slice(0, 12)}</code></dd></div>
          <div><dt>{t('workbench:overview.permission')}</dt><dd>{skill.writable ? t('workbench:overview.writable') : t('workbench:overview.protected')}</dd></div>
        </dl>
        {skill.parentPlugin && <div className="plugin-line">{t('workbench:overview.parentPlugin')} <code>{skill.parentPlugin}</code></div>}
        {skill.family && (
          <div className="family-line">
            <Copy size={14} />
            <span>{t('workbench:overview.family', { count: skill.family.installationIds.length, hosts: skill.family.hosts.map((host) => translatedHost(t, host)).join(' / ') })}</span>
            <StatusPill tone={skill.family.mergeAssessment === 'exact_content' ? 'green' : 'amber'}>{skill.family.mergeAssessment === 'exact_content' ? t('workbench:overview.sameContent') : t('workbench:overview.manualReview')}</StatusPill>
          </div>
        )}
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">{t('workbench:overview.organizeEyebrow')}</span><h3>{t('workbench:overview.organize')}</h3></div>{skill.suggestedCategory !== skill.category && <button className="suggestion-chip" type="button" onClick={() => setCategory(skill.suggestedCategory)}>{t('workbench:overview.localSuggestion', { category: translatedCategory(t, skill.suggestedCategory) })}</button>}</div>
        <div className="organization-help"><Info size={15} /><span>{t('workbench:overview.organizeHelp')}</span></div>
        <div className="organization-row">
          <label><span>{t('workbench:overview.primaryCategory')}</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{SKILL_CATEGORIES.map((item) => <option key={item} value={item}>{translatedCategory(t, item)}</option>)}</select></label>
          <label className="tag-input"><span>{t('workbench:overview.customTags')}</span><div><Tags size={15} /><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t('workbench:overview.tagsPlaceholder')} /></div></label>
          <button className="button compact primary" type="button" disabled={saving || (category === skill.category && tags === skill.tags.join(', '))} onClick={() => void saveOrganization()}><Save size={14} />{t('action.save')}</button>
        </div>
      </section>

      <section className="overview-section">
        <div className="section-title"><div><span className="eyebrow">{t('workbench:overview.auditEyebrow')}</span><h3>{t('workbench:overview.audit')}</h3></div><HealthSummary skill={skill} /></div>
        {skill.diagnostics.length === 0 ? <div className="clean-audit"><CheckCircle2 size={18} /><div><strong>{t('workbench:overview.noIssues')}</strong><p>{t('workbench:overview.noIssuesHelp')}</p></div></div> : (
          <div className="diagnostic-list">{skill.diagnostics.map((diagnostic, index) => <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />)}</div>
        )}
        {skill.duplicateKind && (
          <button className="duplicate-callout" type="button" onClick={() => void setFilters({ duplicateOnly: true }, true)}>
            <Copy size={17} /><div><strong>{skill.duplicateKind === 'exact' ? t('workbench:overview.exactDuplicate') : skill.duplicateKind === 'near' ? t('workbench:overview.nearDuplicate') : t('workbench:overview.nameDuplicate')}</strong><span>{t('workbench:overview.duplicateGroup', { group: skill.duplicateGroup })}</span></div>
          </button>
        )}
      </section>

      <section className="overview-section markdown-section">
        <div className="section-title"><div><span className="eyebrow">{t('workbench:overview.previewEyebrow')}</span><h3>{t('workbench:overview.preview')}</h3></div></div>
        <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>{skill.body || t('workbench:overview.emptyBody')}</ReactMarkdown></article>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="metric"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function HealthSummary({ skill }: { skill: SkillDetails }) {
  const { t } = useTranslation();
  if (skill.health === 'error') return <StatusPill tone="red">{t('workbench:overview.errors', { count: skill.diagnostics.filter((item) => item.severity === 'error').length })}</StatusPill>;
  if (skill.health === 'warning') return <StatusPill tone="amber">{t('workbench:overview.reviews', { count: skill.diagnostics.filter((item) => item.severity === 'warning').length })}</StatusPill>;
  return <StatusPill tone="green">{t('status.healthy')}</StatusPill>;
}

function DiagnosticRow({ diagnostic }: { diagnostic: SkillDiagnostic }) {
  const { t } = useTranslation();
  const Icon = diagnostic.code.includes('link') ? Link2Off : diagnostic.code.includes('binary') ? Binary : diagnostic.severity === 'error' ? AlertCircle : diagnostic.severity === 'warning' ? TriangleAlert : Info;
  const localized = localizedDiagnostic(t, diagnostic);
  return <div className={clsx('diagnostic-row', `diagnostic-${diagnostic.severity}`)}><Icon size={17} /><div><strong>{localized.title}</strong><p>{localized.message}</p>{diagnostic.relativePath && <code>{diagnostic.relativePath}</code>}</div></div>;
}
