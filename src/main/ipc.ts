import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { IPC } from '../shared/ipc';
import {
  organizationSchema,
  renameSchema,
  runAiSchema,
  saveProviderSchema,
  saveSkillNoteSchema,
  skillListFiltersSchema,
  updateBodySchema,
  updateMetadataSchema,
  writeTextSchema
} from '../shared/schemas';
import type { DatabaseContext } from './db/database';
import { AiService } from './ai-service';
import { OperationsService } from './operations-service';
import { NoteService } from './note-service';
import { ProviderService } from './provider-service';
import { RootsService } from './roots-service';
import { ScannerService } from './scanner-service';
import { SkillRepository } from './skill-repository';
import { isPathInside } from './utils';
import { WatchService } from './watch-service';

const idSchema = z.string().uuid();
const pathSchema = z.string().trim().min(1).max(2_000);
const relativePathSchema = z.string().trim().min(1).max(500);

export interface IpcServices {
  database: DatabaseContext;
  roots: RootsService;
  repository: SkillRepository;
  scanner: ScannerService;
  operations: OperationsService;
  notes: NoteService;
  providers: ProviderService;
  ai: AiService;
  watcher: WatchService;
  userDataPath: string;
  version: string;
  mainWindow: BrowserWindow;
}

export function registerIpc(services: IpcServices): () => void {
  const channels: string[] = [];
  const handle = (channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.handle(channel, listener);
    channels.push(channel);
  };

  handle(IPC.APP_BOOTSTRAP, async () => ({
    roots: services.roots.list(),
    skills: withScanState(services.repository.list(), services.scanner.getProgress().running),
    providers: services.providers.list(),
    scanProgress: services.scanner.getProgress(),
    version: services.version,
    userDataPath: services.userDataPath
  }));

  handle(IPC.APP_OPEN_PATH, async (_event, value: unknown) => {
    const target = path.resolve(pathSchema.parse(value));
    const allowed = services.roots.list().some((root) => isPathInside(root.path, target)) || isPathInside(services.userDataPath, target);
    if (!allowed) throw new Error('只能打开已配置根目录内的路径');
    const result = await shell.openPath(target);
    if (result) throw new Error(result);
  });

  handle(IPC.ROOTS_LIST, () => services.roots.list());
  handle(IPC.ROOTS_ADD, async (_event, value: unknown) => {
    const roots = await services.roots.add(pathSchema.parse(value));
    await services.watcher.reset(roots);
    void services.scanner.scanAll();
    return roots;
  });
  handle(IPC.ROOTS_PICK_ADD, async () => {
    const result = await dialog.showOpenDialog(services.mainWindow, { properties: ['openDirectory'], title: '添加项目根目录' });
    if (result.canceled || !result.filePaths[0]) return services.roots.list();
    const roots = await services.roots.add(result.filePaths[0]);
    await services.watcher.reset(roots);
    void services.scanner.scanAll();
    return roots;
  });
  handle(IPC.ROOTS_REMOVE, async (_event, value: unknown) => {
    const roots = services.roots.remove(idSchema.parse(value));
    await services.watcher.reset(roots);
    return roots;
  });
  handle(IPC.ROOTS_RESCAN, () => services.scanner.scanAll());

  handle(IPC.SKILLS_LIST, (_event, value: unknown) => withScanState(services.repository.list(skillListFiltersSchema.parse(value)), services.scanner.getProgress().running));
  handle(IPC.SKILLS_GET, (_event, value: unknown) => services.repository.get(idSchema.parse(value)));
  handle(IPC.SKILLS_READ_TEXT, (_event, skillId: unknown, relativePath: unknown) => services.operations.readText(idSchema.parse(skillId), relativePathSchema.parse(relativePath)));
  handle(IPC.SKILLS_WRITE_TEXT, (_event, value: unknown) => services.operations.writeText(writeTextSchema.parse(value)));
  handle(IPC.SKILLS_UPDATE_METADATA, (_event, value: unknown) => services.operations.updateMetadata(updateMetadataSchema.parse(value)));
  handle(IPC.SKILLS_UPDATE_BODY, (_event, value: unknown) => services.operations.updateBody(updateBodySchema.parse(value)));
  handle(IPC.SKILLS_ORGANIZE, (_event, value: unknown) => services.operations.updateOrganization(organizationSchema.parse(value)));
  handle(IPC.SKILLS_PREVIEW_RENAME_DISPLAY, (_event, value: unknown) => services.operations.previewRenameDisplay(renameSchema.parse(value)));
  handle(IPC.SKILLS_RENAME_DISPLAY, (_event, value: unknown) => services.operations.renameDisplay(renameSchema.parse(value)));
  handle(IPC.SKILLS_PREVIEW_RENAME_INTERNAL, (_event, value: unknown) => services.operations.previewRenameInternal(renameSchema.parse(value)));
  handle(IPC.SKILLS_RENAME_INTERNAL, (_event, value: unknown) => services.operations.renameInternal(renameSchema.parse(value)));
  handle(IPC.SKILLS_TRASH, (_event, value: unknown) => services.operations.moveToTrash(idSchema.parse(value)));
  handle(IPC.SKILLS_RESTORE, (_event, value: unknown) => services.operations.restore(idSchema.parse(value)));

  handle(IPC.NOTES_GET, (_event, value: unknown) => services.notes.get(idSchema.parse(value)));
  handle(IPC.NOTES_SAVE, (_event, value: unknown) => services.notes.save(saveSkillNoteSchema.parse(value)));
  handle(IPC.NOTES_ADD_IMAGE, async (_event, value: unknown) => {
    const skillId = idSchema.parse(value);
    const result = await dialog.showOpenDialog(services.mainWindow, {
      properties: ['openFile'],
      title: '插入备注图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return services.notes.addImage(skillId, result.filePaths[0]);
  });
  handle(IPC.NOTES_REMOVE_IMAGE, (_event, skillId: unknown, imageId: unknown) => services.notes.removeImage(idSchema.parse(skillId), idSchema.parse(imageId)));

  handle(IPC.ANALYSIS_LOCAL, (_event, value: unknown) => services.scanner.rescanSkill(idSchema.parse(value)));
  handle(IPC.ANALYSIS_AI_PREVIEW, (_event, value: unknown) => services.ai.previewInput(idSchema.parse(value)));
  handle(IPC.ANALYSIS_AI_RUN, (_event, value: unknown) => services.ai.run(runAiSchema.parse(value)));
  handle(IPC.ANALYSIS_AI_CANCEL, (_event, value: unknown) => services.ai.cancel(idSchema.parse(value)));

  handle(IPC.PROVIDERS_LIST, () => services.providers.list());
  handle(IPC.PROVIDERS_SAVE, (_event, value: unknown) => services.providers.save(saveProviderSchema.parse(value)));
  handle(IPC.PROVIDERS_TEST, (_event, value: unknown) => services.providers.test(idSchema.parse(value)));
  handle(IPC.PROVIDERS_REMOVE, (_event, value: unknown) => services.providers.remove(idSchema.parse(value)));

  handle(IPC.HISTORY_LIST, (_event, value: unknown) => services.operations.history(z.number().int().min(1).max(1000).optional().parse(value)));
  handle(IPC.HISTORY_DIFF, (_event, value: unknown) => services.operations.showDiff(idSchema.parse(value)));
  handle(IPC.HISTORY_RESTORE, (_event, value: unknown) => services.operations.restoreSnapshot(idSchema.parse(value)));

  const disposeProgress = services.scanner.onProgress((progress) => {
    if (!services.mainWindow.isDestroyed()) services.mainWindow.webContents.send(IPC.EVENT_SCAN_PROGRESS, progress);
    if (!progress.running && !services.mainWindow.isDestroyed()) services.mainWindow.webContents.send(IPC.EVENT_SKILLS_CHANGED);
  });

  return () => {
    disposeProgress();
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}

function withScanState<T extends { scanInProgress: boolean }>(value: T, running: boolean): T {
  return { ...value, scanInProgress: running };
}
