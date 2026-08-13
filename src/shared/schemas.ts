import { z } from 'zod';

const skillId = z.string().uuid();
const expectedHash = z.string().regex(/^[a-f0-9]{64}$/i);
const relativePath = z.string().min(1).max(500).refine((value) => !value.includes('\0'), '路径包含非法字符');

export const skillListFiltersSchema = z
  .object({
    query: z.string().max(200).optional(),
    hosts: z.array(z.enum(['codex', 'claude', 'workbuddy', 'custom'])).optional(),
    sourceTypes: z
      .array(z.enum(['user', 'project', 'plugin', 'builtin', 'marketplace', 'cache', 'trash', 'backup']))
      .optional(),
    health: z.array(z.enum(['error', 'warning', 'healthy'])).optional(),
    category: z.string().max(80).optional(),
    writable: z.boolean().optional(),
    duplicateOnly: z.boolean().optional(),
    state: z.enum(['active', 'disabled', 'trash', 'unknown']).optional(),
    limit: z.number().int().min(1).max(10_000).optional(),
    offset: z.number().int().min(0).optional()
  })
  .optional();

export const updateMetadataSchema = z.object({
  skillId,
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().min(1).max(8_000).optional(),
  expectedHash
});

export const updateBodySchema = z.object({
  skillId,
  body: z.string().max(2_000_000),
  expectedHash
});

export const writeTextSchema = z.object({
  skillId,
  relativePath,
  content: z.string().max(2_000_000),
  expectedHash
});

export const organizationSchema = z.object({
  skillId,
  category: z.string().trim().max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(30)
});

export const saveSkillNoteSchema = z.object({
  skillId,
  body: z.string().max(2_000_000)
});

export const renameSchema = z.object({
  skillId,
  newName: z.string().trim().min(1).max(128).refine((value) => !/[\\/:*?"<>|]/.test(value), '名称包含 Windows 禁止字符'),
  expectedHash
});

export const saveProviderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  protocol: z.enum(['chat_completions', 'responses']),
  baseUrl: z.string().url().max(500).refine((value) => /^https?:\/\//i.test(value), '仅支持 HTTP 或 HTTPS'),
  model: z.string().trim().min(1).max(120),
  timeoutMs: z.number().int().min(5_000).max(300_000),
  headers: z.record(z.string(), z.string().max(2_000)),
  apiKey: z.string().max(4_000).optional(),
  enabled: z.boolean()
});

export const runAiSchema = z.object({
  skillId,
  providerId: z.string().uuid(),
  attachments: z.array(relativePath).max(100),
  expectedHash
});

export const aiAnalysisPayloadSchema = z.object({
  summary: z.string().min(1).max(4_000),
  capabilities: z.array(z.string().min(1).max(300)).max(20),
  recommendedCategory: z.string().min(1).max(80),
  tags: z.array(z.string().min(1).max(40)).max(20),
  triggerQuality: z.enum(['clear', 'mixed', 'weak']),
  compatibilityNotes: z.array(z.string().min(1).max(500)).max(20),
  riskFlags: z.array(z.string().min(1).max(500)).max(20),
  improvementSuggestions: z.array(z.string().min(1).max(500)).max(20),
  confidence: z.number().min(0).max(1)
});

export const aiAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'capabilities',
    'recommendedCategory',
    'tags',
    'triggerQuality',
    'compatibilityNotes',
    'riskFlags',
    'improvementSuggestions',
    'confidence'
  ],
  properties: {
    summary: { type: 'string' },
    capabilities: { type: 'array', items: { type: 'string' } },
    recommendedCategory: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    triggerQuality: { type: 'string', enum: ['clear', 'mixed', 'weak'] },
    compatibilityNotes: { type: 'array', items: { type: 'string' } },
    riskFlags: { type: 'array', items: { type: 'string' } },
    improvementSuggestions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;
