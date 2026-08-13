import { _electron as electron } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-benchmark-'));
let application;

try {
  application = await electron.launch({
    args: [path.resolve('.webpack', 'x64', 'main')],
    env: {
      ...process.env,
      SKILL_WORKBENCH_USER_DATA: userData
    }
  });
  const page = await application.firstWindow();
  const result = await page.evaluate(async () => {
    const deadline = Date.now() + 90_000;
    let observedStart = false;
    let bootstrap = await window.workbench.app.bootstrap();
    while (Date.now() < deadline) {
      bootstrap = await window.workbench.app.bootstrap();
      observedStart ||= bootstrap.scanProgress.running || Boolean(bootstrap.scanProgress.startedAt);
      if (observedStart && !bootstrap.scanProgress.running && bootstrap.scanProgress.finishedAt) break;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    const progress = bootstrap.scanProgress;
    const list = await window.workbench.skills.list({ state: 'active', limit: 1, offset: 0 });
    const disabled = await window.workbench.skills.list({ state: 'disabled', limit: 1, offset: 0 });
    const elapsedMs = progress.startedAt && progress.finishedAt
      ? new Date(progress.finishedAt).getTime() - new Date(progress.startedAt).getTime()
      : null;
    return {
      completed: observedStart && !progress.running && Boolean(progress.finishedAt),
      elapsedMs,
      error: progress.error,
      roots: bootstrap.roots.map((root) => ({
        label: root.label,
        sourceType: root.sourceType,
        skillCount: root.skillCount
      })),
      total: list.stats.total,
      disabled: disabled.total,
      byHost: list.stats.byHost,
      bySource: list.stats.bySource,
      warnings: list.stats.warnings,
      errors: list.stats.errors,
      duplicates: list.stats.duplicates
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.completed || result.error) process.exitCode = 1;
} finally {
  await application?.close().catch(() => undefined);
  await fs.rm(userData, { recursive: true, force: true });
}
