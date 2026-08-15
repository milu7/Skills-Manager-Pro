import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import BetterSqlite3 from 'better-sqlite3/win32-x64';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LocalePreference } from '../../src/shared/types';
import { migrations } from '../../src/main/db/migrations';

test('built Electron app starts with sandboxed renderer and indexes three host formats', async () => {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-e2e-'));
  const projectRoot = path.join(testRoot, 'project');
  const userData = path.join(testRoot, 'user-data');
  const noteImagePath = path.join(testRoot, 'note-example.png');
  await fs.writeFile(noteImagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  await fs.cp(path.resolve('tests/e2e-project'), projectRoot, { recursive: true });
  const longResource = path.join(projectRoot, '.agents', 'skills', 'design-helper', 'references', 'long-guide.md');
  await fs.mkdir(path.dirname(longResource), { recursive: true });
  await fs.writeFile(longResource, Array.from({ length: 260 }, (_, index) => `## 第 ${index + 1} 节\n\n这是用于验证编辑器内部滚动的长内容。`).join('\n\n'));
  const protectedSkill = path.join(projectRoot, '.agents', 'skills', 'builtin', 'system-guard');
  await fs.mkdir(protectedSkill, { recursive: true });
  await fs.writeFile(path.join(protectedSkill, 'SKILL.md'), '---\nname: system-guard\ndescription: 只读来源显示测试。\n---\n\n# 系统保护技能\n');
  await seedLocalePreference(userData, 'zh-CN');
  const application = await electron.launch({
    args: [path.resolve('.webpack', 'x64', 'main')],
    env: {
      ...process.env,
      SKILL_WORKBENCH_USER_DATA: userData,
      SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS: '1',
      SKILL_WORKBENCH_TEST_ROOT: projectRoot
    }
  });
  try {
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1500, height: 940 });
    const menuState = await application.evaluate(({ BrowserWindow, Menu }) => ({
      hasApplicationMenu: Menu.getApplicationMenu() !== null,
      isMenuBarVisible: BrowserWindow.getAllWindows()[0]?.isMenuBarVisible() ?? true
    }));
    expect(menuState).toEqual({ hasApplicationMenu: false, isMenuBarVisible: false });
    await page.keyboard.press('Alt');
    const menuVisibleAfterAlt = await application.evaluate(({ BrowserWindow }) => (
      BrowserWindow.getAllWindows()[0]?.isMenuBarVisible() ?? true
    ));
    expect(menuVisibleAfterAlt).toBe(false);
    await expect(page.getByRole('dialog', { name: '欢迎来到 Skills Manager Pro' })).toBeVisible();
    await page.getByRole('button', { name: '开始浏览' }).click();
    await expect(page.getByText('Skills Manager Pro', { exact: true })).toBeVisible();
    await expect(page.getByText('暴论哥3.0（公众号同名）', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();
    await expect(page.locator('.brand-version')).toHaveText('v0.2.2');
    await expect(page.locator('.brand-version i')).toHaveCSS('background-color', 'rgb(32, 164, 122)');
    await expect(page.getByText('来源宿主，不是内容分类', { exact: true })).toBeVisible();
    const productIcons = page.locator('.side-host .host-mark img');
    await expect(productIcons).toHaveCount(3);
    expect(await productIcons.evaluateAll((images) => images.every((image) => (
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    )))).toBe(true);
    await expect(page.locator('.side-host .host-custom svg')).toHaveCount(1);
    await expect.poll(async () => page.locator('.skill-row').count(), { timeout: 15_000 }).toBe(5);
    await expect(page.getByText('仅用于工作台筛选', { exact: true })).toBeVisible();
    const librarySection = page.locator('.side-section').first();
    const allSkillsFilter = page.getByRole('button', { name: /全部 Skills/ });
    const writableFilter = page.getByRole('button', { name: /可编辑/ });
    await writableFilter.click();
    await expect(writableFilter).toHaveClass(/is-active/);
    await expect(allSkillsFilter).not.toHaveClass(/is-active/);
    await expect(librarySection.locator('.side-item.is-active')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /已停用/ })).toHaveAttribute('title', /enabledPlugins.*false/);
    await allSkillsFilter.click();
    await expect(allSkillsFilter).toHaveClass(/is-active/);
    await expect(page.locator('.skill-row').filter({ hasText: '视觉审计助手' })).toBeVisible();
    await expect(page.locator('.skill-row').filter({ hasText: 'research-assistant' })).toBeVisible();
    await expect(page.locator('.skill-row').filter({ hasText: 'WorkBuddy 发布助手' })).toBeVisible();
    await expect(page.getByRole('button', { name: '批量 AI' })).toBeVisible();
    await expect(page.locator('.brand-mark')).toHaveCount(0);
    const listTypography = await page.locator('.skill-row').first().evaluate((row) => {
      const rail = row.querySelector<HTMLElement>('.health-rail')?.getBoundingClientRect();
      const main = row.querySelector<HTMLElement>('.skill-row-main')?.getBoundingClientRect();
      const title = row.querySelector<HTMLElement>('.skill-title-line strong');
      return {
        railGap: rail && main ? main.left - rail.right : 0,
        titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0
      };
    });
    expect(listTypography.railGap).toBeGreaterThanOrEqual(12);
    expect(listTypography.titleSize).toBeGreaterThanOrEqual(15);
    const rendererCapabilities = await page.evaluate(() => ({
      processType: typeof (globalThis as unknown as { process?: unknown }).process,
      requireType: typeof (globalThis as unknown as { require?: unknown }).require,
      hasWorkbenchApi: typeof window.workbench?.skills?.list === 'function'
    }));
    expect(rendererCapabilities).toEqual({ processType: 'undefined', requireType: 'undefined', hasWorkbenchApi: true });

    await page.locator('.topbar-status').getByRole('button', { name: '软件设置', exact: true }).click();
    await page.keyboard.press('Control+K');
    const globalSearch = page.getByRole('textbox', { name: '搜索 Skills' });
    await expect(globalSearch).toBeEnabled();
    await expect(globalSearch).toBeFocused();
    await globalSearch.fill('视觉审计助手');
    await expect(page.locator('.skill-row')).toHaveCount(1);
    await globalSearch.fill('');
    await expect.poll(async () => page.locator('.skill-row').count()).toBe(5);

    await page.evaluate(() => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
      window.open = (url?: string | URL) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        return null;
      };
    });
    await page.getByRole('button', { name: 'GitHub', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls))
      .toEqual(['https://github.com/milu7/Skills-Manager-Pro']);

    await page.setViewportSize({ width: 1500, height: 520 });
    const sidebarScroller = page.locator('.sidebar-scroll');
    await expect(page.getByRole('button', { name: '下方还有内容，继续查看' })).toBeVisible();
    await expect.poll(async () => sidebarScroller.evaluate((element) => getComputedStyle(element).getPropertyValue('scrollbar-width').trim())).toBe('none');
    await page.screenshot({ path: 'test-results/skill-workbench-sidebar-hint.png', fullPage: true });
    await page.getByRole('button', { name: '下方还有内容，继续查看' }).click();
    await expect.poll(async () => sidebarScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1500, height: 940 });

    await page.locator('.skill-row').filter({ hasText: 'system-guard' }).click();
    await expect(page.locator('.detail-title-line .status-red')).toHaveText('只读');
    await page.getByRole('tab', { name: '概览' }).click();
    await expect(page.getByText('仅用于工作台内筛选和整理；保存后不会移动 Skill、修改目录或影响宿主调用。')).toBeVisible();
    await page.screenshot({ path: 'test-results/skill-workbench-readonly.png', fullPage: true });

    await page.locator('.skill-row').filter({ hasText: '视觉审计助手' }).click();
    await page.getByRole('tab', { name: '编辑' }).click();
    await page.setViewportSize({ width: 1120, height: 760 });
    await page.getByRole('button', { name: 'Markdown 正文' }).click();
    const bodySaveButton = page.getByRole('button', { name: '预览并保存' });
    await expect(bodySaveButton).toBeVisible();
    const bodySaveBounds = await bodySaveButton.boundingBox();
    expect(bodySaveBounds).not.toBeNull();
    expect((bodySaveBounds?.x ?? 0) + (bodySaveBounds?.width ?? 0)).toBeLessThanOrEqual(1120);
    await page.screenshot({ path: 'test-results/skill-workbench-editor-body.png', fullPage: true });
    await page.getByRole('button', { name: '高级资源' }).click();
    await page.getByRole('button', { name: /references[\\/]long-guide\.md/ }).click();
    const resourceScroller = page.locator('.resource-code .cm-scroller');
    await expect(resourceScroller).toBeVisible();
    const scrollMetrics = await resourceScroller.evaluate((element) => {
      const target = element as HTMLElement;
      target.scrollTop = Math.max(1, target.scrollHeight - target.clientHeight);
      return { scrollHeight: target.scrollHeight, clientHeight: target.clientHeight, scrollTop: target.scrollTop, overflowY: getComputedStyle(target).overflowY };
    });
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
    expect(['auto', 'scroll']).toContain(scrollMetrics.overflowY);
    await page.screenshot({ path: 'test-results/skill-workbench-editor-resource.png', fullPage: true });

    await page.getByRole('tab', { name: '备注' }).click();
    const noteEditor = page.locator('.note-editor .cm-content');
    await expect(noteEditor).toHaveClass(/cm-lineWrapping/);
    await noteEditor.fill('## E2E 使用备注\n\n先检查输入，再调用 Skill。');
    await page.getByRole('button', { name: '保存备注' }).click();
    await expect(page.getByRole('status')).toContainText('备注已保存');
    await application.evaluate(({ dialog }, imagePath) => {
      (dialog as unknown as { showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }> }).showOpenDialog = async () => ({ canceled: false, filePaths: [imagePath] });
    }, noteImagePath);
    await page.getByRole('button', { name: '插入图片' }).click();
    await expect(page.getByRole('status')).toContainText('图片已插入');
    await expect(page.locator('.note-preview img')).toHaveCount(1);
    await expect(page.locator('.note-attachments figure')).toHaveCount(1);
    const savedNote = await page.evaluate(async () => {
      const rows = await window.workbench.skills.list({ query: '视觉审计助手' });
      const id = rows.items[0]?.id;
      return id ? window.workbench.notes.get(id) : null;
    });
    expect(savedNote?.body).toContain('E2E 使用备注');
    expect(savedNote?.images).toHaveLength(1);
    await page.setViewportSize({ width: 1500, height: 940 });
    await page.screenshot({ path: 'test-results/skill-workbench-note.png', fullPage: true });

    await page.locator('.topbar-status').getByRole('button', { name: '软件设置', exact: true }).click();
    await page.getByTestId('settings-ai-tab').click();
    await page.getByLabel('配置名称').fill('E2E Mock');
    await page.getByLabel('Base URL').fill('http://127.0.0.1:65534');
    await page.getByLabel('模型').fill('mock-model');
    await page.getByLabel('API Key').fill('temporary-test-key');
    await page.getByRole('button', { name: '加密保存' }).click();
    await expect(page.getByRole('status')).toContainText('加密保存');
    await expect(page.getByRole('heading', { name: 'AI 服务', exact: true })).toBeVisible();
    const toggleSize = await page.getByRole('checkbox', { name: '启用此服务' }).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(toggleSize.width).toBeLessThanOrEqual(18);
    expect(toggleSize.height).toBeLessThanOrEqual(18);
    await page.screenshot({ path: 'test-results/skill-workbench-settings.png', fullPage: true });
    await page.getByRole('button', { name: 'Skills Manager Pro 首页' }).click();
    await page.getByRole('button', { name: '批量 AI' }).click();
    const batchDialog = page.getByRole('dialog', { name: '批量 AI 分析确认' });
    await expect(batchDialog).toBeVisible();
    await expect(batchDialog.locator('.batch-ai-row')).toHaveCount(5);
    await expect(batchDialog).toContainText('确认 5 个文件');
    await batchDialog.getByRole('button', { name: '返回' }).click();

    await page.locator('.skill-row').filter({ hasText: '视觉审计助手' }).click();
    await page.getByRole('tab', { name: '编辑' }).click();
    const description = page.locator('.metadata-editor textarea');
    await expect(description).toHaveValue('为本地产品界面提供视觉审计、排版和色彩建议。');
    await description.fill('E2E 临时修改：检查布局与颜色。');
    await page.getByRole('button', { name: '预览并保存' }).click();
    await expect(page.getByRole('dialog')).toContainText('确认修改说明');
    await page.getByRole('button', { name: '确认保存' }).click();
    await expect(page.getByRole('status')).toContainText('修改已保存');

    await page.getByRole('button', { name: '操作历史' }).click();
    await expect(page.locator('.history-list')).toContainText('编辑结构化元数据');
    await page.getByRole('button', { name: '恢复此前快照' }).click();
    await expect(page.getByRole('status')).toContainText('保存成功');

    await page.screenshot({ path: 'test-results/skill-workbench-main.png', fullPage: true });
  } finally {
    await application.close();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
});

test('switches to English immediately, preserves user content, and restores the preference after restart', async () => {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-i18n-e2e-'));
  const projectRoot = path.join(testRoot, 'project');
  const userData = path.join(testRoot, 'user-data');
  await fs.cp(path.resolve('tests/e2e-project'), projectRoot, { recursive: true });
  const fixturePath = path.join(projectRoot, '.agents', 'skills', 'design-helper', 'SKILL.md');
  const fixtureBefore = await fs.readFile(fixturePath, 'utf8');
  await seedLocalePreference(userData, 'zh-CN');
  let application: ElectronApplication | null = null;

  try {
    application = await launchWorkbench(userData, projectRoot);
    let page = await application.firstWindow();
    await setWindowSize(application, 1120, 720);
    const guide = page.getByRole('dialog', { name: '欢迎来到 Skills Manager Pro' });
    await expect(guide).toBeVisible();
    await guide.getByRole('button', { name: '开始浏览' }).click();
    await expect.poll(async () => page.locator('.skill-row').count(), { timeout: 15_000 }).toBeGreaterThan(0);

    await page.locator('.topbar-status').getByRole('button', { name: '软件设置', exact: true }).click();
    await expect(page.getByRole('heading', { name: '软件设置', exact: true })).toBeVisible();
    await page.getByTestId('locale-select').selectOption('en-US');

    await expect(page.getByRole('heading', { name: 'Software settings', exact: true })).toBeVisible();
    await expect(page.getByTestId('locale-select')).toHaveValue('en-US');
    await expect(page.getByRole('status')).toContainText('Language preference saved');
    await expect.poll(async () => page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title
    }))).toEqual({ lang: 'en-US', dir: 'ltr', title: 'Skills Manager Pro' });
    await expect.poll(async () => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle()))
      .toBe('Skills Manager Pro');

    await page.getByTestId('settings-ai-tab').click();
    await expect(page.getByRole('heading', { name: 'AI services', exact: true })).toBeVisible();
    const compactLayout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      panelWidth: document.querySelector<HTMLElement>('.wide-panel')?.scrollWidth ?? 0,
      panelClientWidth: document.querySelector<HTMLElement>('.wide-panel')?.clientWidth ?? 0
    }));
    expect(compactLayout.bodyWidth).toBeLessThanOrEqual(compactLayout.viewportWidth);
    expect(compactLayout.panelWidth).toBeLessThanOrEqual(compactLayout.panelClientWidth);
    await page.screenshot({ path: 'test-results/skill-workbench-settings-en.png', fullPage: true });
    await page.getByLabel('Configuration name').fill('Invalid endpoint');
    await page.getByLabel('Base URL').fill('ftp://example.com');
    await page.getByLabel('Model').fill('test-model');
    await page.getByRole('button', { name: 'Save securely' }).click();
    await expect(page.getByRole('status')).toContainText('Only HTTP or HTTPS addresses are supported');
    await page.getByRole('button', { name: 'Close notification' }).click();

    await page.getByRole('button', { name: 'Skills Manager Pro home' }).click();
    await expect(page.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();
    await expect(page.getByText('暴论哥3.0（公众号同名）', { exact: true })).toHaveCount(0);
    await expect(page.locator('.skill-row').filter({ hasText: '视觉审计助手' })).toBeVisible();
    await expect(page.locator('.skill-row').filter({ hasText: '为本地产品界面提供视觉审计、排版和色彩建议。' })).toBeVisible();
    const sidebarLayout = await page.locator('.sidebar').evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      bottom: element.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight
    }));
    expect(sidebarLayout.scrollWidth).toBeLessThanOrEqual(sidebarLayout.clientWidth);
    expect(sidebarLayout.bottom).toBeLessThanOrEqual(sidebarLayout.viewportHeight + 0.5);

    await page.locator('.topbar-status').getByRole('button', { name: 'Manage scan roots' }).click();
    const rootsDialog = page.getByRole('dialog', { name: 'Scan folders' });
    await expect(rootsDialog).toBeVisible();
    await expect.poll(async () => rootsDialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    const dialogLayout = await rootsDialog.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left, top: box.top, right: box.right, bottom: box.bottom,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight
      };
    });
    expect(dialogLayout.left).toBeGreaterThanOrEqual(0);
    expect(dialogLayout.top).toBeGreaterThanOrEqual(0);
    expect(dialogLayout.right).toBeLessThanOrEqual(dialogLayout.viewportWidth + 0.5);
    expect(dialogLayout.bottom).toBeLessThanOrEqual(dialogLayout.viewportHeight + 0.5);
    expect(dialogLayout.scrollWidth).toBeLessThanOrEqual(dialogLayout.clientWidth);
    await page.screenshot({ path: 'test-results/skill-workbench-roots-en.png', fullPage: true });
    await rootsDialog.getByRole('button', { name: 'Close' }).click();
    expect(await fs.readFile(fixturePath, 'utf8')).toBe(fixtureBefore);

    await application.close();
    application = await launchWorkbench(userData, projectRoot);
    page = await application.firstWindow();
    await setWindowSize(application, 1120, 720);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByText('Skills Manager Pro', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /All Skills/ })).toBeVisible();
    await expect.poll(async () => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle()))
      .toBe('Skills Manager Pro');
  } finally {
    await application?.close();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
});

test('shows a newly discovered TRAE platform with its catalogue name and brand icon', async () => {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-workbench-trae-e2e-'));
  const home = path.join(testRoot, 'home');
  const userData = path.join(testRoot, 'user-data');
  const traeSkill = path.join(home, '.trae', 'skills', 'trae-helper');
  await fs.mkdir(traeSkill, { recursive: true });
  await fs.writeFile(path.join(traeSkill, 'SKILL.md'), '---\nname: trae-helper\ndescription: TRAE helper skill.\n---\n\nBody.\n');
  await seedLocalePreference(userData, 'zh-CN');
  let application: ElectronApplication | null = null;
  try {
    // Redirect Node's os.homedir() so initializeDefaults discovers ~/.trae/skills
    // as a new platform root; storage stays isolated via SKILL_WORKBENCH_USER_DATA.
    application = await electron.launch({
      args: [path.resolve('.webpack', 'x64', 'main')],
      env: { ...process.env, USERPROFILE: home, SKILL_WORKBENCH_USER_DATA: userData }
    });
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1500, height: 940 });
    const guide = page.getByRole('dialog', { name: '欢迎来到 Skills Manager Pro' });
    if (await guide.isVisible().catch(() => false)) {
      await guide.getByRole('button', { name: '开始浏览' }).click();
    }
    await expect.poll(async () => page.locator('.side-host').count(), { timeout: 15_000 }).toBe(5);
    const traeHost = page.locator('.side-host', { hasText: 'TRAE IDE' });
    await expect(traeHost).toBeVisible();
    const traeMark = traeHost.locator('.host-mark');
    await expect(traeMark).toHaveClass(/has-icon/);
    await expect(traeMark.locator('img')).toBeVisible();
    await expect(traeMark.locator('img')).toHaveAttribute('src', /\.svg$/);
    await expect(traeMark.locator('img')).toHaveJSProperty('complete', true);
    expect(await traeMark.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(traeHost.locator('b')).toHaveText('1');
    await expect(page.getByText('host.trae', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/skill-workbench-trae.png', fullPage: true });
  } finally {
    await application?.close();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
});

async function launchWorkbench(userData: string, projectRoot: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [path.resolve('.webpack', 'x64', 'main')],
    env: {
      ...process.env,
      SKILL_WORKBENCH_USER_DATA: userData,
      SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS: '1',
      SKILL_WORKBENCH_TEST_ROOT: projectRoot
    }
  });
}

async function setWindowSize(application: ElectronApplication, width: number, height: number): Promise<void> {
  await application.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
  }, { width, height });
}

async function seedLocalePreference(userData: string, preference: LocalePreference): Promise<void> {
  await fs.mkdir(userData, { recursive: true });
  const sqlite = new BetterSqlite3(path.join(userData, 'skill-workbench.sqlite3'));
  try {
    for (const migration of migrations) {
      sqlite.exec(migration.sql);
      sqlite.pragma(`user_version = ${migration.version}`);
    }
    sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('locale.preference', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(preference, new Date().toISOString());
  } finally {
    sqlite.close();
  }
}
