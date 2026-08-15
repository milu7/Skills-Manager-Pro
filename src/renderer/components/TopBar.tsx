import { FolderCog, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchStore } from '../store';
import { IconButton } from './common';
import { useTranslation } from 'react-i18next';
import { localizedScanPhase } from '../i18n';

export function TopBar({ onManageRoots }: { onManageRoots(): void }) {
  const { t } = useTranslation();
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
    notify('info', t('workbench:topbar.rescanStarted'));
    try { await window.workbench.roots.rescan(); } catch (error) { notify('error', String(error)); }
  };

  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => setView('skills')} aria-label={t('app.home')}>
        <span className="brand-copy">
          <span className="brand-title"><strong>{t('app.title')}</strong>{version && <span className="brand-version"><i />v{version}</span>}</span>
        </span>
      </button>
      <div className="global-search" data-disabled={view !== 'skills'}>
        <Search size={17} />
        <input
          ref={searchRef}
          value={query}
          disabled={view !== 'skills'}
          onChange={(event) => search(event.target.value)}
          placeholder={t('workbench:topbar.searchPlaceholder')}
          aria-label={t('workbench:topbar.searchAria')}
        />
        <kbd>Ctrl K</kbd>
      </div>
      <div className="topbar-status">
        <span className={progress?.running ? 'scan-indicator is-running' : 'scan-indicator'}>
          <i />{progress?.running ? t('workbench:topbar.scanRunning', { phase: localizedScanPhase(t, progress), count: progress.discoveredSkills }) : t('workbench:topbar.indexReady')}
        </span>
        <IconButton label={t('workbench:topbar.manageRoots')} onClick={onManageRoots}><FolderCog size={18} /></IconButton>
        <IconButton label={t('common:action.rescan')} onClick={() => void rescan()} disabled={progress?.running}><RefreshCw size={18} className={progress?.running ? 'spin' : ''} /></IconButton>
        <IconButton label={t('workbench:topbar.settings')} className={view === 'settings' ? 'is-active' : ''} onClick={() => setView('settings')}><SlidersHorizontal size={18} /></IconButton>
      </div>
    </header>
  );
}

let searchTimer = 0;
