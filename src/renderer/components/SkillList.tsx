import { ChevronDown, Copy, FileWarning, Filter, LockKeyhole, SearchX, ShieldCheck, Sparkles } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import type { SkillInstallation, SkillSourceType } from '../../shared/types';
import { useWorkbenchStore } from '../store';
import { EmptyState, StatusPill, formatDate } from './common';
import { useState } from 'react';
import { BatchAiDialog } from './BatchAiDialog';

const sourceLabels: Record<SkillSourceType, string> = {
  user: '用户', project: '项目', plugin: '插件', builtin: '内置', marketplace: '市场', cache: '缓存', trash: '回收站', backup: '备份'
};

export function SkillList() {
  const list = useWorkbenchStore((state) => state.list);
  const selectedId = useWorkbenchStore((state) => state.selectedId);
  const select = useWorkbenchStore((state) => state.select);
  const filters = useWorkbenchStore((state) => state.filters);
  const setFilters = useWorkbenchStore((state) => state.setFilters);
  const loading = useWorkbenchStore((state) => state.loading);
  const providers = useWorkbenchStore((state) => state.providers);
  const setView = useWorkbenchStore((state) => state.setView);
  const notify = useWorkbenchStore((state) => state.notify);
  const [batchOpen, setBatchOpen] = useState(false);

  const openBatch = () => {
    if (!providers.some((provider) => provider.enabled)) {
      notify('info', '请先配置并启用一个 AI 服务');
      setView('providers');
      return;
    }
    if (!list?.items.length) return;
    if (list.items.length > 20) {
      notify('error', `当前结果有 ${list.items.length} 个；请先用平台、来源或分类缩小到 20 个以内`);
      return;
    }
    setBatchOpen(true);
  };

  return (
    <section className="skill-column">
      <header className="list-header">
        <div><span className="eyebrow">技能目录</span><h1>{filterTitle(filters)} <em>{list?.total ?? 0}</em></h1></div>
        <div className="list-header-actions">
          <button className="filter-button" type="button" disabled={!list?.items.length} onClick={openBatch}><Sparkles size={14} />批量 AI</button>
          <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className="filter-button" type="button"><Filter size={14} />来源<ChevronDown size={13} /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-content" align="end" sideOffset={6}>
              <DropdownMenu.Label>来源类型</DropdownMenu.Label>
              {(['user', 'project', 'plugin', 'builtin', 'marketplace', 'cache', 'backup'] as SkillSourceType[]).map((source) => (
                <DropdownMenu.CheckboxItem key={source} checked={filters.sourceTypes?.includes(source)} onCheckedChange={() => {
                  const current = filters.sourceTypes ?? [];
                  const next = current.includes(source) ? current.filter((item) => item !== source) : [...current, source];
                  void setFilters({ sourceTypes: next.length ? next : undefined });
                }} className="dropdown-item">{sourceLabels[source]}</DropdownMenu.CheckboxItem>
              ))}
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="dropdown-item" onSelect={() => void setFilters({ sourceTypes: undefined })}>清除来源筛选</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="list-summary">
        <span><ShieldCheck size={14} />可编辑 {list?.stats.writable ?? 0}</span>
        <span><FileWarning size={14} />问题 {(list?.stats.errors ?? 0) + (list?.stats.warnings ?? 0)}</span>
        <span><Copy size={14} />重复 {list?.stats.duplicates ?? 0}</span>
      </div>

      <div className={clsx('skill-list', loading && 'is-loading')} role="listbox" aria-label="Skill 列表">
        {list?.items.map((skill) => <SkillRow key={skill.id} skill={skill} selected={skill.id === selectedId} onClick={() => void select(skill.id)} />)}
        {list && list.items.length === 0 && <EmptyState icon={<SearchX size={24} />} title="没有符合条件的 Skill" detail="试试清除平台、状态或来源筛选。" />}
      </div>
      <BatchAiDialog open={batchOpen} skills={list?.items ?? []} onOpenChange={setBatchOpen} />
    </section>
  );
}

function SkillRow({ skill, selected, onClick }: { skill: SkillInstallation; selected: boolean; onClick(): void }) {
  return (
    <button type="button" role="option" aria-selected={selected} className={clsx('skill-row', selected && 'is-selected')} onClick={onClick}>
      <span className={clsx('health-rail', `health-${skill.health}`)} />
      <div className="skill-row-main">
        <div className="skill-title-line"><strong>{skill.displayName}</strong>{!skill.writable && <LockKeyhole size={12} />}{skill.duplicateKind && <Copy size={12} />}</div>
        <p>{skill.description}</p>
        <div className="skill-meta-line">
          <span className={`platform-text platform-${skill.host}`}>{skill.host === 'workbuddy' ? 'WorkBuddy' : skill.host === 'custom' ? 'Agent' : capitalize(skill.host)}</span>
          <i />
          <span>{sourceLabels[skill.sourceType]}</span>
          <i />
          <span>{skill.category}</span>
        </div>
      </div>
      <div className="skill-row-side">
        {skill.state === 'disabled' ? <StatusPill>停用</StatusPill> : skill.health === 'error' ? <StatusPill tone="red">错误</StatusPill> : skill.health === 'warning' ? <StatusPill tone="amber">检查</StatusPill> : null}
        <small>{formatDate(skill.updatedAt)}</small>
      </div>
    </button>
  );
}

function filterTitle(filters: ReturnType<typeof useWorkbenchStore.getState>['filters']): string {
  if (filters.state === 'trash') return '回收站';
  if (filters.state === 'disabled') return '已停用 Skills';
  if (filters.duplicateOnly) return '重复项';
  if (filters.health?.includes('error')) return '存在错误';
  if (filters.health?.includes('warning')) return '需要检查';
  if (filters.writable) return '可编辑 Skills';
  if (filters.category) return filters.category;
  if (filters.hosts?.[0]) return `${capitalize(filters.hosts[0])} Skills`;
  return '全部 Skills';
}

function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
