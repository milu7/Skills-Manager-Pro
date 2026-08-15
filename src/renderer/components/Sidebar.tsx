import { AlertCircle, ArchiveRestore, Bot, Boxes, ChevronDown, CircleOff, Clock3, Copy, FolderCog, LockKeyhole, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostPlatform, SkillHealth } from '../../shared/types';
import { useWorkbenchStore } from '../store';
import { useTranslation } from 'react-i18next';
import { isToolHost, toolColorClass, toolIcon, toolMarkText, translatedCategory, translatedHost } from '../i18n';
import { AI_TOOL_LOCATIONS } from '../../shared/ai-tool-catalog';
import { APP_GITHUB_URL } from '../../shared/constants';

const ALWAYS_VISIBLE_HOSTS: HostPlatform[] = ['codex', 'claude', 'workbuddy', 'custom'];
const toolOrder = new Map(AI_TOOL_LOCATIONS.map((tool, index) => [tool.key, index]));

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

  const hostEntries = useMemo<HostPlatform[]>(() => {
    const byHost = stats?.byHost ?? {};
    const present = Object.keys(byHost).filter((host) => (byHost[host] ?? 0) > 0);
    const discovered = present
      .filter((host) => !ALWAYS_VISIBLE_HOSTS.includes(host as HostPlatform))
      .sort((left, right) =>
        (toolOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (toolOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
        || left.localeCompare(right));
    return [...ALWAYS_VISIBLE_HOSTS, ...discovered];
  }, [stats]);

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
              {hostEntries.map((id) => {
                const icon = toolIcon(id);
                const isTool = isToolHost(id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={id === 'custom' ? t('workbench:sidebar.customHelp') : t('workbench:sidebar.hostHelp', { host: translatedHost(t, id) })}
                    className={clsx('side-host', filters.hosts?.includes(id) && view === 'skills' && 'is-active')}
                    onClick={() => showSkills({ hosts: [id], state: 'active' })}
                  >
                    <span className={clsx('host-mark', `host-${id}`, icon && 'has-icon', !icon && isTool && 'is-tool', !icon && isTool && toolColorClass(id))} aria-hidden="true">
                      {icon ? <img src={icon} alt="" /> : isTool ? <span>{toolMarkText(id)}</span> : <Bot size={15} />}
                    </span><span>{translatedHost(t, id)}</span><b>{stats?.byHost[id] ?? 0}</b>
                  </button>
                );
              })}
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
        <button type="button" onClick={() => window.open(APP_GITHUB_URL, '_blank', 'noopener')}><GithubIcon size={16} /><span>{t('app.github')}</span></button>
        <div className="privacy-note"><LockKeyhole size={13} /><span>{t('workbench:sidebar.privacy')}</span></div>
      </footer>
    </aside>
  );
}

function SideItem({ active, icon, label, count, tone, title, onClick }: { active?: boolean; icon: React.ReactNode; label: string; count?: number; tone?: string; title?: string; onClick(): void }) {
  return <button type="button" title={title} className={clsx('side-item', active && 'is-active', tone && `tone-${tone}`)} onClick={onClick}>{icon}<span>{label}</span><b>{count ?? 0}</b></button>;
}

// GitHub brand mark, drawn to match the stroke style of the Lucide icons used
// elsewhere in the sidebar (lucide v1 no longer ships brand icons).
function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}
