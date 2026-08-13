import chokidar, { type FSWatcher } from 'chokidar';
import type { SkillRoot } from '../shared/types';
import { ScannerService } from './scanner-service';
import { isPathInside } from './utils';

export class WatchService {
  private watcher: FSWatcher | null = null;
  private roots: SkillRoot[] = [];
  private changedRootIds = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly scanner: ScannerService) {}

  async reset(roots: SkillRoot[]): Promise<void> {
    await this.close();
    this.roots = roots.filter((root) => root.enabled);
    if (this.roots.length === 0) return;
    this.watcher = chokidar.watch(this.roots.map((root) => root.path), {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 24,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (candidatePath) => /(?:^|[\\/])(?:node_modules|\.git|sessions|session-cache)(?:[\\/]|$)/i.test(candidatePath)
    });
    this.watcher.on('all', (_eventName, changedPath) => this.enqueue(changedPath));
    this.watcher.on('error', (error) => console.warn('Skill watcher error:', error));
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.changedRootIds.clear();
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
  }

  private enqueue(changedPath: string): void {
    for (const root of this.roots) {
      if (isPathInside(root.path, changedPath)) this.changedRootIds.add(root.id);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const ids = [...this.changedRootIds];
      this.changedRootIds.clear();
      this.timer = null;
      void this.scanner.scanRoots(ids);
    }, 700);
  }
}
