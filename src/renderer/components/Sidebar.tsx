import { AlertCircle, ArchiveRestore, Boxes, ChevronDown, CircleOff, Clock3, Copy, FolderCog, LockKeyhole, Orbit, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { HostPlatform, SkillHealth } from '../../shared/types';
import { useWorkbenchStore } from '../store';
import { AuthorModal } from './AuthorModal';
import { useTranslation } from 'react-i18next';
import { translatedCategory, translatedHost } from '../i18n';

const hosts: Array<{ id: HostPlatform; mark: string }> = [
  { id: 'codex', mark: 'CX' },
  { id: 'claude', mark: 'CL' },
  { id: 'workbuddy', mark: 'WB' },
  { id: 'custom', mark: 'AG' }
];

export function Sidebar({ onManageRoots }: { onManageRoots(): void }) {
  const { t } = useTranslation();
  const list = useWorkbenchStore((state) => state.list);
  const filters = useWorkbenchStore((state) => state.filters);
  const setFilters = useWorkbenchStore((state) => state.setFilters);
  const view = useWorkbenchStore((state) => state.view);
  const setView = useWorkbenchStore((state) => state.setView);
  const setSettingsSection = useWorkbenchStore((state) => state.setSettingsSection);
  const stats = list?.stats;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const updateHint = () => {
      const remaining = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      setHasMoreBelow(remaining > 4);
    };
    const observer = new ResizeObserver(updateHint);
    observer.observe(scrollElement);
    const content = scrollElement.firstElementChild;
    if (content instanceof HTMLElement) observer.observe(content);
    scrollElement.addEventListener('scroll', updateHint, { passive: true });
    const frame = window.requestAnimationFrame(updateHint);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      scrollElement.removeEventListener('scroll', updateHint);
    };
  }, [stats, view]);

  const showSkills = (next: Parameters<typeof setFilters>[0]) => {
    setView('skills');
    void setFilters(next, true);
  };
  const healthFilter = (health: SkillHealth) => showSkills({ health: [health], state: 'active' });
  const openSettings = () => { setSettingsSection('general'); setView('settings'); };
  const allSkillsActive = view === 'skills'
    && filters.state === 'active'
    && !filters.hosts?.length
    && !filters.sourceTypes?.length
    && !filters.health?.length
    && !filters.category
    && filters.writable === undefined
    && !filters.duplicateOnly;

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll-shell">
        <div className="sidebar-scroll" ref={scrollRef}>
          <div className="sidebar-scroll-content">
            <section className="side-section">
              <h2>{t('workbench:sidebar.library')}</h2>
              <SideItem active={allSkillsActive} icon={<Boxes size={16} />} label={t('workbench:sidebar.all')} count={stats?.total} onClick={() => showSkills({ state: 'active' })} />
              <SideItem active={view === 'skills' && filters.writable === true} icon={<Wrench size={16} />} label={t('workbench:sidebar.editable')} count={stats?.writable} onClick={() => showSkills({ writable: true, state: 'active' })} />
              <SideItem active={view === 'skills' && Boolean(filters.duplicateOnly)} icon={<Copy size={16} />} label={t('workbench:sidebar.duplicates')} count={stats?.duplicates} onClick={() => showSkills({ duplicateOnly: true, state: 'active' })} />
              <SideItem active={view === 'skills' && filters.health?.includes('error')} icon={<AlertCircle size={16} />} label={t('workbench:sidebar.errors')} count={stats?.errors} tone="red" onClick={() => healthFilter('error')} />
              <SideItem active={view === 'skills' && filters.health?.includes('warning')} icon={<TriangleAlert size={16} />} label={t('workbench:sidebar.review')} count={stats?.warnings} tone="amber" onClick={() => healthFilter('warning')} />
              <SideItem
                active={view === 'skills' && filters.state === 'disabled'}
                icon={<CircleOff size={16} />}
                label={t('workbench:sidebar.disabled')}
                count={stats?.disabled}
                title={t('workbench:sidebar.disabledHelp')}
                onClick={() => showSkills({ state: 'disabled' })}
              />
              <SideItem active={view === 'skills' && filters.state === 'trash'} icon={<ArchiveRestore size={16} />} label={t('workbench:sidebar.trash')} count={stats?.trashed} onClick={() => showSkills({ state: 'trash' })} />
            </section>

            <section className="side-section">
              <h2>{t('workbench:sidebar.platforms')}</h2>
              <p className="side-section-note">{t('workbench:sidebar.platformsHelp')}</p>
              {hosts.map((host) => (
                <button key={host.id} type="button" title={host.id === 'custom' ? t('workbench:sidebar.customHelp') : t('workbench:sidebar.hostHelp', { host: translatedHost(t, host.id) })} className={clsx('side-host', filters.hosts?.includes(host.id) && view === 'skills' && 'is-active')} onClick={() => showSkills({ hosts: [host.id], state: 'active' })}>
                  <span className={`host-mark host-${host.id}`}>{host.mark}</span><span>{translatedHost(t, host.id)}</span><b>{stats?.byHost[host.id] ?? 0}</b>
                </button>
              ))}
            </section>

            {stats && stats.categories.length > 0 && (
              <section className="side-section side-categories">
                <h2>{t('workbench:sidebar.categories')}</h2>
                <p className="side-section-note">{t('workbench:sidebar.categoriesHelp')}</p>
                {stats.categories.slice(0, 10).map((category) => (
                  <button key={category.name} type="button" className={clsx(filters.category === category.name && view === 'skills' && 'is-active')} onClick={() => showSkills({ category: category.name, state: 'active' })}>
                    <span>{translatedCategory(t, category.name)}</span><b>{category.count}</b>
                  </button>
                ))}
              </section>
            )}
          </div>
        </div>
        {hasMoreBelow && (
          <button
            className="sidebar-more-hint"
            type="button"
            aria-label={t('workbench:sidebar.moreAria')}
            onClick={() => scrollRef.current?.scrollBy({ top: Math.max(160, scrollRef.current.clientHeight * .55), behavior: 'smooth' })}
          >
            <ChevronDown size={14} /><span>{t('workbench:sidebar.more')}</span>
          </button>
        )}
      </div>
      <footer className="sidebar-footer">
        <button type="button" onClick={() => setView('history')} className={view === 'history' ? 'is-active' : ''}><Clock3 size={16} /><span>{t('workbench:sidebar.history')}</span></button>
        <button type="button" onClick={openSettings} className={view === 'settings' ? 'is-active' : ''}><Sparkles size={16} /><span>{t('workbench:sidebar.settings')}</span></button>
        <button type="button" onClick={onManageRoots}><FolderCog size={16} /><span>{t('workbench:sidebar.roots')}</span></button>
        <button type="button" onClick={() => setAuthorOpen(true)}><Orbit size={16} /><span>{t('app.authorName')}</span></button>
        <div className="privacy-note"><LockKeyhole size={13} /><span>{t('workbench:sidebar.privacy')}</span></div>
      </footer>
      <AuthorModal open={authorOpen} onOpenChange={setAuthorOpen} />
    </aside>
  );
}

function SideItem({ active, icon, label, count, tone, title, onClick }: { active?: boolean; icon: React.ReactNode; label: string; count?: number; tone?: string; title?: string; onClick(): void }) {
  return <button type="button" title={title} className={clsx('side-item', active && 'is-active', tone && `tone-${tone}`)} onClick={onClick}>{icon}<span>{label}</span><b>{count ?? 0}</b></button>;
}
