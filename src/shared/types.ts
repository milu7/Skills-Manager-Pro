export type HostPlatform = 'codex' | 'claude' | 'workbuddy' | 'custom';
export type SkillScope = 'user' | 'project' | 'plugin' | 'system';
export type SkillSourceType =
  | 'user'
  | 'project'
  | 'plugin'
  | 'builtin'
  | 'marketplace'
  | 'cache'
  | 'trash'
  | 'backup';
export type SkillState = 'active' | 'disabled' | 'trash' | 'unknown';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type SkillHealth = 'error' | 'warning' | 'healthy';
export type DuplicateKind = 'exact' | 'name' | 'near' | null;
export type AiProtocol = 'chat_completions' | 'responses';

export interface SkillDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  relativePath?: string;
}

export interface SkillRoot {
  id: string;
  label: string;
  path: string;
  host: HostPlatform;
  scope: SkillScope;
  sourceType: SkillSourceType;
  writable: boolean;
  recursive: boolean;
  enabled: boolean;
  discovered: boolean;
  lastScannedAt: string | null;
  skillCount: number;
}

export interface SkillInstallation {
  id: string;
  rootId: string;
  host: HostPlatform;
  scope: SkillScope;
  sourceType: SkillSourceType;
  state: SkillState;
  path: string;
  realPath: string;
  originalPath: string | null;
  folderName: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  suggestedCategory: string;
  tags: string[];
  writable: boolean;
  parentPlugin: string | null;
  contentHash: string;
  fileCount: number;
  sizeBytes: number;
  lineCount: number;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  hasAgentMetadata: boolean;
  health: SkillHealth;
  diagnostics: SkillDiagnostic[];
  duplicateGroup: string | null;
  duplicateKind: DuplicateKind;
  updatedAt: string;
  indexedAt: string;
}

export interface SkillFamily {
  id: string;
  logicalName: string;
  installationIds: string[];
  hosts: HostPlatform[];
  contentHashes: string[];
  mergeAssessment: 'exact_content' | 'review_required';
}

export interface SkillFileEntry {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  kind: 'main' | 'metadata' | 'reference' | 'asset' | 'script' | 'other';
  text: boolean;
  editable: boolean;
}

export interface SkillTextFile {
  skillId: string;
  relativePath: string;
  content: string;
  contentHash: string;
  language: 'markdown' | 'yaml' | 'json' | 'text' | 'code';
  editable: boolean;
  newline: 'lf' | 'crlf';
  hasBom: boolean;
}

export interface SkillDetails extends SkillInstallation {
  frontmatter: Record<string, unknown>;
  body: string;
  mainFileHash: string;
  files: SkillFileEntry[];
  family: SkillFamily | null;
  latestAiAnalysis: AiAnalysis | null;
}

export interface SkillNoteImage {
  id: string;
  skillId: string;
  filename: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

export interface SkillNote {
  skillId: string;
  body: string;
  updatedAt: string | null;
  images: SkillNoteImage[];
}

export interface SaveSkillNoteInput {
  skillId: string;
  body: string;
}

export interface SkillListFilters {
  query?: string;
  hosts?: HostPlatform[];
  sourceTypes?: SkillSourceType[];
  health?: SkillHealth[];
  category?: string;
  writable?: boolean;
  duplicateOnly?: boolean;
  state?: SkillState;
  limit?: number;
  offset?: number;
}

export interface SkillStats {
  total: number;
  writable: number;
  warnings: number;
  errors: number;
  duplicates: number;
  disabled: number;
  trashed: number;
  byHost: Record<HostPlatform, number>;
  bySource: Partial<Record<SkillSourceType, number>>;
  categories: Array<{ name: string; count: number }>;
}

export interface SkillListResult {
  items: SkillInstallation[];
  total: number;
  stats: SkillStats;
  scanInProgress: boolean;
}

export interface LocalAnalysisResult {
  skillId: string;
  health: SkillHealth;
  diagnostics: SkillDiagnostic[];
  suggestedCategory: string;
  duplicateKind: DuplicateKind;
  duplicateGroup: string | null;
  analyzedAt: string;
}

export interface UpdateMetadataInput {
  skillId: string;
  name?: string;
  description?: string;
  expectedHash: string;
}

export interface UpdateBodyInput {
  skillId: string;
  body: string;
  expectedHash: string;
}

export interface WriteTextInput {
  skillId: string;
  relativePath: string;
  content: string;
  expectedHash: string;
}

export interface OrganizationInput {
  skillId: string;
  category: string;
  tags: string[];
}

export interface RenamePreview {
  skillId: string;
  mode: 'display' | 'internal';
  oldValue: string;
  newValue: string;
  targetPath: string | null;
  changes: Array<{
    relativePath: string;
    before: string;
    after: string;
  }>;
  warnings: string[];
}

export interface RenameInput {
  skillId: string;
  newName: string;
  expectedHash: string;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  skillId?: string;
  actionId?: string;
}

export type ActionType =
  | 'edit_metadata'
  | 'edit_body'
  | 'edit_file'
  | 'rename_display'
  | 'rename_internal'
  | 'trash'
  | 'restore'
  | 'restore_snapshot'
  | 'organize'
  | 'ai_analyze';

export interface ActionLog {
  id: string;
  skillId: string | null;
  action: ActionType;
  path: string;
  summary: string;
  beforeHash: string | null;
  afterHash: string | null;
  snapshotId: string | null;
  createdAt: string;
  reversible: boolean;
}

export interface Snapshot {
  id: string;
  skillId: string;
  relativePath: string;
  contentHash: string;
  reason: string;
  createdAt: string;
}

export interface AiProvider {
  id: string;
  name: string;
  protocol: AiProtocol;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  headers: Record<string, string>;
  hasApiKey: boolean;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: 'success' | 'failure' | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAiProviderInput {
  id?: string;
  name: string;
  protocol: AiProtocol;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  headers: Record<string, string>;
  apiKey?: string;
  enabled: boolean;
}

export interface AiAttachmentCandidate {
  relativePath: string;
  sizeBytes: number;
  includedByDefault: boolean;
  reason: string;
}

export interface AiInputPreview {
  skillId: string;
  mainFileBytes: number;
  attachmentBudgetBytes: number;
  attachments: AiAttachmentCandidate[];
  excluded: AiAttachmentCandidate[];
  estimatedCharacters: number;
}

export interface RunAiInput {
  skillId: string;
  providerId: string;
  attachments: string[];
  expectedHash: string;
}

export interface AiAnalysisPayload {
  summary: string;
  capabilities: string[];
  recommendedCategory: string;
  tags: string[];
  triggerQuality: 'clear' | 'mixed' | 'weak';
  compatibilityNotes: string[];
  riskFlags: string[];
  improvementSuggestions: string[];
  confidence: number;
}

export interface AiAnalysis extends AiAnalysisPayload {
  id: string;
  skillId: string;
  providerId: string;
  providerName: string;
  model: string;
  protocol: AiProtocol;
  contentHash: string;
  stale: boolean;
  inputFiles: string[];
  inputBytes: number;
  createdAt: string;
}

export interface ScanProgress {
  running: boolean;
  phase: string;
  completedRoots: number;
  totalRoots: number;
  discoveredSkills: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface AppBootstrap {
  roots: SkillRoot[];
  skills: SkillListResult;
  providers: AiProvider[];
  scanProgress: ScanProgress;
  version: string;
  userDataPath: string;
}

export interface WorkbenchApi {
  app: {
    bootstrap(): Promise<AppBootstrap>;
    openPath(path: string): Promise<void>;
  };
  roots: {
    list(): Promise<SkillRoot[]>;
    add(path: string): Promise<SkillRoot[]>;
    pickAndAdd(): Promise<SkillRoot[]>;
    remove(id: string): Promise<SkillRoot[]>;
    rescan(): Promise<ScanProgress>;
  };
  skills: {
    list(filters?: SkillListFilters): Promise<SkillListResult>;
    get(id: string): Promise<SkillDetails>;
    readText(skillId: string, relativePath: string): Promise<SkillTextFile>;
    writeText(input: WriteTextInput): Promise<OperationResult>;
    updateMetadata(input: UpdateMetadataInput): Promise<OperationResult>;
    updateBody(input: UpdateBodyInput): Promise<OperationResult>;
    updateOrganization(input: OrganizationInput): Promise<OperationResult>;
    previewRenameDisplay(input: RenameInput): Promise<RenamePreview>;
    renameDisplay(input: RenameInput): Promise<OperationResult>;
    previewRenameInternal(input: RenameInput): Promise<RenamePreview>;
    renameInternal(input: RenameInput): Promise<OperationResult>;
    moveToTrash(skillId: string): Promise<OperationResult>;
    restore(skillId: string): Promise<OperationResult>;
  };
  notes: {
    get(skillId: string): Promise<SkillNote>;
    save(input: SaveSkillNoteInput): Promise<SkillNote>;
    addImage(skillId: string): Promise<SkillNoteImage | null>;
    removeImage(skillId: string, imageId: string): Promise<SkillNote>;
  };
  analysis: {
    runLocal(skillId: string): Promise<LocalAnalysisResult>;
    previewAiInput(skillId: string): Promise<AiInputPreview>;
    runAi(input: RunAiInput): Promise<AiAnalysis>;
    cancel(skillId: string): Promise<void>;
  };
  providers: {
    list(): Promise<AiProvider[]>;
    save(input: SaveAiProviderInput): Promise<AiProvider>;
    test(id: string): Promise<{ ok: boolean; message: string }>;
    remove(id: string): Promise<void>;
  };
  history: {
    list(limit?: number): Promise<ActionLog[]>;
    showDiff(id: string): Promise<{ before: string; after: string; relativePath: string }>;
    restore(snapshotId: string): Promise<OperationResult>;
  };
  events: {
    onScanProgress(listener: (progress: ScanProgress) => void): () => void;
    onSkillsChanged(listener: () => void): () => void;
  };
}

declare global {
  interface Window {
    workbench: WorkbenchApi;
  }
}

export {};
