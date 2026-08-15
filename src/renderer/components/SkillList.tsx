import { ChevronDown, Copy, FileWarning, Filter, LockKeyhole, SearchX, ShieldCheck, Sparkles } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import type { SkillInstallation, SkillListFilters, SkillSourceType } from '../../shared/types';
import { useWorkbenchStore } from '../store';
import { EmptyState, StatusPill, formatDate } from './common';
import { useState } from 'react';
import { BatchAiDialog } from './BatchAiDialog';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { isToolHost, translatedCategory, translatedHost, translatedSource } from '../i18n';

export function SkillList() {
  const { t } = useTranslation();
  const list = useWorkbenchStore((state) => state.list);
  const selectedId = useWorkbenchStore((state) => state.selectedId);
  const select = useWorkbenchStore((state) => state.select);
  const filters = useWorkbenchStore((state) => state.filters);
  const setFilters = useWorkbenchStore((state) => state.setFilters);
  const loading = useWorkbenchStore((state) => state.loading);
  const providers = useWorkbenchStore((state) => state.providers);
  const setView = useWorkbenchStore((state) => state.setView);
  const setSettingsSection = useWorkbenchStore((state) => state.setSettingsSection);
  const notify = useWorkbenchStore((state) => state.notify);
  const [batchOpen, setBatchOpen] = useState(false);

  const openBatch = () => {
    if (!providers.some((provider) => provider.enabled)) {
      notify('info', t('workbench:list.configureAi'));
      setSettingsSection('ai');
      setView('settings');
      return;
    }
    if (!list?.items.length) return;
    if (list.items.length > 20) {
      notify('error', t('workbench:list.narrowBatch', { count: list.items.length }));
      return;
    }
    setBatchOpen(true);
  };

  return (
    <section className="skill-column">
      <header className="list-header">
        <div><span className="eyebrow">{t('workbench:list.eyebrow')}</span><h1>{filterTitle(t, filters)} <em>{list?.total ?? 0}</em></h1></div>
        <div className="list-header-actions">
          <button className="filter-button" type="button" disabled={!list?.items.length} onClick={openBatch}><Sparkles size={14} />{t('workbench:list.batchAi')}</button>
          <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className="filter-button" type="button"><Filter size={14} />{t('workbench:list.source')}<ChevronDown size={13} /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-content" align="end" sideOffset={6}>
              <DropdownMenu.Label>{t('workbench:list.sourceType')}</DropdownMenu.Label>
              {(['user', 'project', 'plugin', 'builtin', 'marketplace', 'cache', 'backup'] as SkillSourceType[]).map((source) => (
                <DropdownMenu.CheckboxItem key={source} checked={filters.sourceTypes?.includes(source)} onCheckedChange={() => {
                  const current = filters.sourceTypes ?? [];
                  const next = current.includes(source) ? current.filter((item) => item !== source) : [...current, source];
                  void setFilters({ sourceTypes: next.length ? next : undefined });
                }} className="dropdown-item">{translatedSource(t, source)}</DropdownMenu.CheckboxItem>
              ))}
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="dropdown-item" onSelect={() => void setFilters({ sourceTypes: undefined })}>{t('workbench:list.clearSource')}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="list-summary">
        <span><ShieldCheck size={14} />{t('workbench:list.editableCount', { count: list?.stats.writable ?? 0 })}</span>
        <span><FileWarning size={14} />{t('workbench:list.issueCount', { count: (list?.stats.errors ?? 0) + (list?.stats.warnings ?? 0) })}</span>
        <span><Copy size={14} />{t('workbench:list.duplicateCount', { count: list?.stats.duplicates ?? 0 })}</span>
      </div>

      <div className={clsx('skill-list', loading && 'is-loading')} role="listbox" aria-label={t('workbench:list.aria')}>
        {list?.items.map((skill) => <SkillRow key={skill.id} skill={skill} selected={skill.id === selectedId} onClick={() => void select(skill.id)} />)}
        {list && list.items.length === 0 && <EmptyState icon={<SearchX size={24} />} title={t('workbench:list.emptyTitle')} detail={t('workbench:list.emptyDetail')} />}
      </div>
      <BatchAiDialog open={batchOpen} skills={list?.items ?? []} onOpenChange={setBatchOpen} />
    </section>
  );
}

function SkillRow({ skill, selected, onClick }: { skill: SkillInstallation; selected: boolean; onClick(): void }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="option" aria-selected={selected} className={clsx('skill-row', selected && 'is-selected')} onClick={onClick}>
      <span className={clsx('health-rail', `health-${skill.health}`)} />
      <div className="skill-row-main">
        <div className="skill-title-line"><strong>{skill.displayName}</strong>{!skill.writable && <LockKeyhole size={12} />}{skill.duplicateKind && <Copy size={12} />}</div>
        <p>{skill.description || t('workbench:list.noDescription')}</p>
        <div className="skill-meta-line">
          <span className={clsx('platform-text', `platform-${skill.host}`, isToolHost(skill.host) && 'is-tool')}>{translatedHost(t, skill.host)}</span>
          <i />
          <span>{translatedSource(t, skill.sourceType)}</span>
          <i />
          <span>{translatedCategory(t, skill.category)}</span>
        </div>
      </div>
      <div className="skill-row-side">
        {skill.state === 'disabled' ? <StatusPill>{t('workbench:list.disabled')}</StatusPill> : skill.health === 'error' ? <StatusPill tone="red">{t('workbench:list.error')}</StatusPill> : skill.health === 'warning' ? <StatusPill tone="amber">{t('workbench:list.review')}</StatusPill> : null}
        <small>{formatDate(skill.updatedAt)}</small>
      </div>
    </button>
  );
}

function filterTitle(t: TFunction, filters: SkillListFilters): string {
  if (filters.state === 'trash') return t('workbench:list.titleTrash');
  if (filters.state === 'disabled') return t('workbench:list.titleDisabled');
  if (filters.duplicateOnly) return t('workbench:list.titleDuplicates');
  if (filters.health?.includes('error')) return t('workbench:list.titleErrors');
  if (filters.health?.includes('warning')) return t('workbench:list.titleReview');
  if (filters.writable) return t('workbench:list.titleEditable');
  if (filters.category) return translatedCategory(t, filters.category);
  if (filters.hosts?.[0]) return `${translatedHost(t, filters.hosts[0])} Skills`;
  return t('workbench:list.titleAll');
}
