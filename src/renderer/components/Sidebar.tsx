import { AlertCircle, ArchiveRestore, Boxes, ChevronDown, CircleOff, Clock3, Copy, FolderCog, LockKeyhole, Orbit, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { HostPlatform, SkillHealth } from '../../shared/types';
import { useWorkbenchStore } from '../store';
import { AuthorModal } from './AuthorModal';

const hosts: Array<{ id: HostPlatform; label: string; mark: string }> = [
  { id: 'codex', label: 'Codex', mark: 'CX' },
  { id: 'claude', label: 'Claude', mark: 'CL' },
  { id: 'workbuddy', label: 'WorkBuddy', mark: 'WB' },
  { id: 'custom', label: '通用 / 自定义', mark: 'AG' }
];

export function Sidebar({ onManageRoots }: { onManageRoots(): void }) {
  const list = useWorkbenchStore((state) => state.list);
  const filters = useWorkbenchStore((state) => state.filters);
  const setFilters = useWorkbenchStore((state) => state.setFilters);
  const view = useWorkbenchStore((state) => state.view);
  const setView = useWorkbenchStore((state) => state.setView);
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

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll-shell">
        <div className="sidebar-scroll" ref={scrollRef}>
          <div className="sidebar-scroll-content">
            <section className="side-section">
              <h2>资料库</h2>
              <SideItem active={view === 'skills' && !filters.hosts && !filters.health && !filters.duplicateOnly && filters.state === 'active'} icon={<Boxes size={16} />} label="全部 Skills" count={stats?.total} onClick={() => showSkills({ state: 'active' })} />
              <SideItem active={Boolean(filters.writable)} icon={<Wrench size={16} />} label="可编辑" count={stats?.writable} onClick={() => showSkills({ writable: true, state: 'active' })} />
              <SideItem active={Boolean(filters.duplicateOnly)} icon={<Copy size={16} />} label="重复项" count={stats?.duplicates} onClick={() => showSkills({ duplicateOnly: true, state: 'active' })} />
              <SideItem active={filters.health?.includes('error')} icon={<AlertCircle size={16} />} label="错误" count={stats?.errors} tone="red" onClick={() => healthFilter('error')} />
              <SideItem active={filters.health?.includes('warning')} icon={<TriangleAlert size={16} />} label="需检查" count={stats?.warnings} tone="amber" onClick={() => healthFilter('warning')} />
              <SideItem active={filters.state === 'disabled'} icon={<CircleOff size={16} />} label="已停用" count={stats?.disabled} onClick={() => showSkills({ state: 'disabled' })} />
              <SideItem active={filters.state === 'trash'} icon={<ArchiveRestore size={16} />} label="回收站" count={stats?.trashed} onClick={() => showSkills({ state: 'trash' })} />
            </section>

            <section className="side-section">
              <h2>平台</h2>
              <p className="side-section-note">来源宿主，不是内容分类</p>
              {hosts.map((host) => (
                <button key={host.id} type="button" title={host.id === 'custom' ? '用户添加且无法识别为 Codex、Claude 或 WorkBuddy 的扫描目录；无需导入 Skill' : `${host.label} 宿主中发现的 Skill`} className={clsx('side-host', filters.hosts?.includes(host.id) && view === 'skills' && 'is-active')} onClick={() => showSkills({ hosts: [host.id], state: 'active' })}>
                  <span className={`host-mark host-${host.id}`}>{host.mark}</span><span>{host.label}</span><b>{stats?.byHost[host.id] ?? 0}</b>
                </button>
              ))}
            </section>

            {stats && stats.categories.length > 0 && (
              <section className="side-section side-categories">
                <h2>分类</h2>
                <p className="side-section-note">仅用于工作台筛选</p>
                {stats.categories.slice(0, 10).map((category) => (
                  <button key={category.name} type="button" className={clsx(filters.category === category.name && view === 'skills' && 'is-active')} onClick={() => showSkills({ category: category.name, state: 'active' })}>
                    <span>{category.name}</span><b>{category.count}</b>
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
            aria-label="下方还有内容，继续查看"
            onClick={() => scrollRef.current?.scrollBy({ top: Math.max(160, scrollRef.current.clientHeight * .55), behavior: 'smooth' })}
          >
            <ChevronDown size={14} /><span>下方还有内容</span>
          </button>
        )}
      </div>
      <footer className="sidebar-footer">
        <button type="button" onClick={() => setView('history')} className={view === 'history' ? 'is-active' : ''}><Clock3 size={16} /><span>操作历史</span></button>
        <button type="button" onClick={() => setView('providers')} className={view === 'providers' ? 'is-active' : ''}><Sparkles size={16} /><span>AI 服务</span></button>
        <button type="button" onClick={onManageRoots}><FolderCog size={16} /><span>扫描目录</span></button>
        <button type="button" onClick={() => setAuthorOpen(true)}><Orbit size={16} /><span>戳戳作者👽</span></button>
        <div className="privacy-note"><LockKeyhole size={13} /><span>本地索引 · 密钥由系统保护</span></div>
      </footer>
      <AuthorModal open={authorOpen} onOpenChange={setAuthorOpen} />
    </aside>
  );
}

function SideItem({ active, icon, label, count, tone, onClick }: { active?: boolean; icon: React.ReactNode; label: string; count?: number; tone?: string; onClick(): void }) {
  return <button type="button" className={clsx('side-item', active && 'is-active', tone && `tone-${tone}`)} onClick={onClick}>{icon}<span>{label}</span><b>{count ?? 0}</b></button>;
}
