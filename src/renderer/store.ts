import { create } from 'zustand';
import type {
  AiProvider,
  AppBootstrap,
  ScanProgress,
  SkillDetails,
  SkillListFilters,
  SkillListResult,
  SkillRoot
} from '../shared/types';

export type WorkspaceView = 'skills' | 'history' | 'settings';
export type SettingsSection = 'general' | 'ai';

interface WorkbenchState {
  initialized: boolean;
  loading: boolean;
  detailLoading: boolean;
  bootstrap: AppBootstrap | null;
  list: SkillListResult | null;
  roots: SkillRoot[];
  providers: AiProvider[];
  progress: ScanProgress | null;
  selectedId: string | null;
  details: SkillDetails | null;
  filters: SkillListFilters;
  view: WorkspaceView;
  settingsSection: SettingsSection;
  toast: { kind: 'success' | 'error' | 'info'; message: string } | null;
  initialize(): Promise<void>;
  primeBootstrap(bootstrap: AppBootstrap): void;
  refreshList(preferSelection?: string | null): Promise<void>;
  refreshDetails(): Promise<void>;
  select(id: string): Promise<void>;
  setFilters(filters: Partial<SkillListFilters>, replace?: boolean): Promise<void>;
  setView(view: WorkspaceView): void;
  setSettingsSection(section: SettingsSection): void;
  updateLocale(locale: AppBootstrap['locale']): void;
  setProgress(progress: ScanProgress): void;
  updateRoots(roots: SkillRoot[]): void;
  updateProviders(providers: AiProvider[]): void;
  notify(kind: 'success' | 'error' | 'info', message: string): void;
  clearToast(): void;
}

const emptyFilters: SkillListFilters = { state: 'active', limit: 2500, offset: 0 };

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  initialized: false,
  loading: false,
  detailLoading: false,
  bootstrap: null,
  list: null,
  roots: [],
  providers: [],
  progress: null,
  selectedId: null,
  details: null,
  filters: emptyFilters,
  view: 'skills',
  settingsSection: 'general',
  toast: null,

  async initialize() {
    if (get().initialized || get().loading) return;
    set({ loading: true });
    try {
      const bootstrap = get().bootstrap ?? await window.workbench.app.bootstrap();
      const filtered = await window.workbench.skills.list(get().filters);
      const selectedId = filtered.items[0]?.id ?? null;
      set({
        initialized: true,
        loading: false,
        bootstrap,
        list: filtered,
        roots: bootstrap.roots,
        providers: bootstrap.providers,
        progress: bootstrap.scanProgress,
        selectedId
      });
      if (selectedId) await get().select(selectedId);
    } catch (error) {
      set({ loading: false, initialized: true, toast: { kind: 'error', message: readableError(error) } });
    }
  },

  primeBootstrap(bootstrap) { set({ bootstrap }); },

  async refreshList(preferSelection) {
    const result = await window.workbench.skills.list(get().filters);
    const requested = preferSelection === undefined ? get().selectedId : preferSelection;
    // #16: when the selection is filtered out, keep it instead of jumping to
    // the first row — filtering must not yank the user's view away. Details
    // stay cached; a stale selection surfaces its own error if it ever breaks.
    const current = requested && result.items.some((item) => item.id === requested) ? requested : get().selectedId ?? null;
    set({ list: result, selectedId: current, details: current === get().selectedId ? get().details : null });
    if (current && (!get().details || get().details?.id !== current)) await get().select(current);
    if (!current) set({ details: null });
  },

  async refreshDetails() {
    const id = get().selectedId;
    if (!id) return;
    await get().select(id);
  },

  async select(id) {
    set({ selectedId: id, detailLoading: true });
    try {
      const details = await window.workbench.skills.get(id);
      if (get().selectedId === id) set({ details, detailLoading: false });
    } catch (error) {
      set({ detailLoading: false, toast: { kind: 'error', message: readableError(error) } });
    }
  },

  async setFilters(filters, replace = false) {
    const next = replace ? { ...emptyFilters, ...filters } : { ...get().filters, ...filters, offset: 0 };
    set({ filters: next, loading: true });
    try {
      await get().refreshList();
    } catch (error) {
      set({ toast: { kind: 'error', message: readableError(error) } });
    } finally {
      set({ loading: false });
    }
  },

  setView(view) { set({ view }); },
  setSettingsSection(settingsSection) { set({ settingsSection }); },
  updateLocale(locale) {
    const bootstrap = get().bootstrap;
    if (bootstrap) set({ bootstrap: { ...bootstrap, locale } });
  },
  setProgress(progress) { set({ progress }); },
  updateRoots(roots) { set({ roots }); },
  updateProviders(providers) { set({ providers }); },
  notify(kind, message) {
    set({ toast: { kind, message } });
    window.setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, 4200);
  },
  clearToast() { set({ toast: null }); }
}));

export function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}
