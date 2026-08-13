import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './shared/ipc';
import type { ScanProgress, WorkbenchApi } from './shared/types';

const api: WorkbenchApi = {
  app: {
    bootstrap: () => ipcRenderer.invoke(IPC.APP_BOOTSTRAP),
    openPath: (path) => ipcRenderer.invoke(IPC.APP_OPEN_PATH, path)
  },
  roots: {
    list: () => ipcRenderer.invoke(IPC.ROOTS_LIST),
    add: (path) => ipcRenderer.invoke(IPC.ROOTS_ADD, path),
    pickAndAdd: () => ipcRenderer.invoke(IPC.ROOTS_PICK_ADD),
    remove: (id) => ipcRenderer.invoke(IPC.ROOTS_REMOVE, id),
    rescan: () => ipcRenderer.invoke(IPC.ROOTS_RESCAN)
  },
  skills: {
    list: (filters) => ipcRenderer.invoke(IPC.SKILLS_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC.SKILLS_GET, id),
    readText: (skillId, relativePath) => ipcRenderer.invoke(IPC.SKILLS_READ_TEXT, skillId, relativePath),
    writeText: (input) => ipcRenderer.invoke(IPC.SKILLS_WRITE_TEXT, input),
    updateMetadata: (input) => ipcRenderer.invoke(IPC.SKILLS_UPDATE_METADATA, input),
    updateBody: (input) => ipcRenderer.invoke(IPC.SKILLS_UPDATE_BODY, input),
    updateOrganization: (input) => ipcRenderer.invoke(IPC.SKILLS_ORGANIZE, input),
    previewRenameDisplay: (input) => ipcRenderer.invoke(IPC.SKILLS_PREVIEW_RENAME_DISPLAY, input),
    renameDisplay: (input) => ipcRenderer.invoke(IPC.SKILLS_RENAME_DISPLAY, input),
    previewRenameInternal: (input) => ipcRenderer.invoke(IPC.SKILLS_PREVIEW_RENAME_INTERNAL, input),
    renameInternal: (input) => ipcRenderer.invoke(IPC.SKILLS_RENAME_INTERNAL, input),
    moveToTrash: (skillId) => ipcRenderer.invoke(IPC.SKILLS_TRASH, skillId),
    restore: (skillId) => ipcRenderer.invoke(IPC.SKILLS_RESTORE, skillId)
  },
  notes: {
    get: (skillId) => ipcRenderer.invoke(IPC.NOTES_GET, skillId),
    save: (input) => ipcRenderer.invoke(IPC.NOTES_SAVE, input),
    addImage: (skillId) => ipcRenderer.invoke(IPC.NOTES_ADD_IMAGE, skillId),
    removeImage: (skillId, imageId) => ipcRenderer.invoke(IPC.NOTES_REMOVE_IMAGE, skillId, imageId)
  },
  analysis: {
    runLocal: (skillId) => ipcRenderer.invoke(IPC.ANALYSIS_LOCAL, skillId),
    previewAiInput: (skillId) => ipcRenderer.invoke(IPC.ANALYSIS_AI_PREVIEW, skillId),
    runAi: (input) => ipcRenderer.invoke(IPC.ANALYSIS_AI_RUN, input),
    cancel: (skillId) => ipcRenderer.invoke(IPC.ANALYSIS_AI_CANCEL, skillId)
  },
  providers: {
    list: () => ipcRenderer.invoke(IPC.PROVIDERS_LIST),
    save: (input) => ipcRenderer.invoke(IPC.PROVIDERS_SAVE, input),
    test: (id) => ipcRenderer.invoke(IPC.PROVIDERS_TEST, id),
    remove: (id) => ipcRenderer.invoke(IPC.PROVIDERS_REMOVE, id)
  },
  history: {
    list: (limit) => ipcRenderer.invoke(IPC.HISTORY_LIST, limit),
    showDiff: (id) => ipcRenderer.invoke(IPC.HISTORY_DIFF, id),
    restore: (snapshotId) => ipcRenderer.invoke(IPC.HISTORY_RESTORE, snapshotId)
  },
  events: {
    onScanProgress: (listener) => subscribe(IPC.EVENT_SCAN_PROGRESS, listener),
    onSkillsChanged: (listener) => subscribe(IPC.EVENT_SKILLS_CHANGED, listener)
  }
};

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('workbench', api);
