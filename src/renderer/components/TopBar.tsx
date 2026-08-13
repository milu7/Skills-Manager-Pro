import { FolderCog, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchStore } from '../store';
import { IconButton } from './common';

export function TopBar({ onManageRoots }: { onManageRoots(): void }) {
  const filters = useWorkbenchStore((state) => state.filters);
  const setFilters = useWorkbenchStore((state) => state.setFilters);
  const setView = useWorkbenchStore((state) => state.setView);
  const view = useWorkbenchStore((state) => state.view);
  const progress = useWorkbenchStore((state) => state.progress);
  const version = useWorkbenchStore((state) => state.bootstrap?.version);
  const notify = useWorkbenchStore((state) => state.notify);
  const [query, setQuery] = useState(filters.query ?? '');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      event.stopPropagation();
      if (view !== 'skills') {
        setView('skills');
        window.setTimeout(focusSearch, 0);
      } else {
        focusSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [setView, view]);

  const search = (value: string) => {
    setQuery(value);
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void setFilters({ query: value || undefined }), 180);
  };

  const rescan = async () => {
    notify('info', '后台扫描已开始');
    try { await window.workbench.roots.rescan(); } catch (error) { notify('error', String(error)); }
  };

  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => setView('skills')} aria-label="Skill 管理工作台首页">
        <span className="brand-copy">
          <span className="brand-title"><strong>Skill 管理工作台</strong>{version && <span className="brand-version"><i />v{version}</span>}</span>
          <span className="brand-meta"><small>暴论哥3.0（公众号同名）</small></span>
        </span>
      </button>
      <div className="global-search" data-disabled={view !== 'skills'}>
        <Search size={17} />
        <input
          ref={searchRef}
          value={query}
          disabled={view !== 'skills'}
          onChange={(event) => search(event.target.value)}
          placeholder="搜索名称、说明、正文或路径…"
          aria-label="搜索 Skills"
        />
        <kbd>Ctrl K</kbd>
      </div>
      <div className="topbar-status">
        <span className={progress?.running ? 'scan-indicator is-running' : 'scan-indicator'}>
          <i />{progress?.running ? `${progress.phase} · ${progress.discoveredSkills}` : '索引已就绪'}
        </span>
        <IconButton label="管理扫描根目录" onClick={onManageRoots}><FolderCog size={18} /></IconButton>
        <IconButton label="重新扫描" onClick={() => void rescan()} disabled={progress?.running}><RefreshCw size={18} className={progress?.running ? 'spin' : ''} /></IconButton>
        <IconButton label="AI 服务设置" className={view === 'providers' ? 'is-active' : ''} onClick={() => setView('providers')}><SlidersHorizontal size={18} /></IconButton>
      </div>
    </header>
  );
}

let searchTimer = 0;
