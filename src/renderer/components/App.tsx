import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useWorkbenchStore } from '../store';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { SkillList } from './SkillList';
import { DetailPane } from './DetailPane';
import { RootManager } from './RootManager';
import { HistoryPanel } from './HistoryPanel';
import { ProviderSettings } from './ProviderSettings';
import { FirstRunGuide, hasSeenFirstRunGuide } from './FirstRunGuide';

export function App() {
  const initialize = useWorkbenchStore((state) => state.initialize);
  const initialized = useWorkbenchStore((state) => state.initialized);
  const refreshList = useWorkbenchStore((state) => state.refreshList);
  const setProgress = useWorkbenchStore((state) => state.setProgress);
  const view = useWorkbenchStore((state) => state.view);
  const toast = useWorkbenchStore((state) => state.toast);
  const clearToast = useWorkbenchStore((state) => state.clearToast);
  const [rootsOpen, setRootsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => !hasSeenFirstRunGuide());

  useEffect(() => {
    void initialize();
    const stopProgress = window.workbench.events.onScanProgress(setProgress);
    const stopChanged = window.workbench.events.onSkillsChanged(() => void refreshList());
    return () => { stopProgress(); stopChanged(); };
  }, [initialize, refreshList, setProgress]);

  if (!initialized) {
    return (
      <div className="splash-screen">
        <div className="splash-mark"><span>S</span><i /></div>
        <p>正在打开 Skill 索引…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar onManageRoots={() => setRootsOpen(true)} />
      <div className="workspace">
        <Sidebar onManageRoots={() => setRootsOpen(true)} />
        {view === 'skills' ? (
          <>
            <SkillList />
            <DetailPane />
          </>
        ) : view === 'history' ? (
          <HistoryPanel />
        ) : (
          <ProviderSettings />
        )}
      </div>
      <RootManager open={rootsOpen} onOpenChange={setRootsOpen} />
      <FirstRunGuide
        open={guideOpen}
        onOpenChange={setGuideOpen}
        onManageRoots={() => setRootsOpen(true)}
      />
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.kind === 'error' ? <AlertTriangle size={17} /> : toast.kind === 'info' ? <RefreshCw size={17} /> : <span className="toast-dot" />}
          <span>{toast.message}</span>
          <button type="button" onClick={clearToast} aria-label="关闭通知"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
