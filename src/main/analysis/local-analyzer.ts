import path from 'node:path';
import type { DiagnosticSeverity, HostPlatform, SkillDiagnostic, SkillHealth } from '../../shared/types';
import { UNTERMINATED_FRONTMATTER_ERROR, type ParsedSkillDocument } from '../skill-document';

export const INITIAL_CATEGORIES = [
  '写作内容',
  '视觉设计',
  '开发工程',
  '自动化',
  '数据办公',
  '研究分析',
  '发布运营',
  '安全合规',
  '商业金融',
  '平台管理',
  '未分类'
] as const;

const categoryRules: Array<[string, RegExp]> = [
  ['安全合规', /安全|合规|privacy|security|audit|xss|compliance/i],
  ['商业金融', /金融|基金|投资|财务|stock|finance|fund|business/i],
  ['视觉设计', /封面|图片|视觉|设计|海报|avatar|image|design|brand|figma/i],
  ['写作内容', /写作|文章|润色|文案|编辑|writing|article|copy|editor/i],
  ['研究分析', /研究|调研|分析|报告|research|analysis|investigate/i],
  ['数据办公', /表格|文档|幻灯片|数据|excel|sheet|document|slides|csv/i],
  ['发布运营', /发布|社交|运营|小红书|微信|post|publish|social|marketing/i],
  ['自动化', /自动化|浏览器|抓取|工作流|automation|browser|scrape|workflow/i],
  ['平台管理', /skill|plugin|marketplace|安装|管理|codex|claude|workbuddy/i],
  ['开发工程', /代码|开发|测试|构建|部署|api|code|develop|test|build|deploy/i]
];

export function suggestCategory(name: string, description: string, body: string): string {
  const corpus = `${name}\n${description}\n${body.slice(0, 12_000)}`;
  let best = { category: '未分类', score: 0 };
  for (const [category, expression] of categoryRules) {
    const matches = corpus.match(new RegExp(expression.source, `${expression.flags.includes('g') ? expression.flags : `${expression.flags}g`}`));
    const score = matches?.length ?? 0;
    if (score > best.score) best = { category, score };
  }
  return best.category;
}

export interface AnalyzeDocumentInput {
  host: HostPlatform;
  folderName: string;
  parsed: ParsedSkillDocument;
  mainFileBytes: number;
  hasScripts: boolean;
  binaryCount: number;
  agentMetadataError?: string;
  brokenLinks: Array<{ path: string; outside: boolean }>;
  escapedSymlink: boolean;
}

export function analyzeDocument(input: AnalyzeDocumentInput): SkillDiagnostic[] {
  const diagnostics: SkillDiagnostic[] = [];
  for (const error of input.parsed.errors) {
    if (error === UNTERMINATED_FRONTMATTER_ERROR) {
      diagnostics.push({
        code: 'frontmatter-unclosed',
        severity: 'error',
        title: 'YAML 无法解析',
        message: 'YAML frontmatter 缺少结束分隔符'
      });
    } else {
      diagnostics.push({ code: 'yaml-invalid', severity: 'error', title: 'YAML 无法解析', message: error, params: { error } });
    }
  }
  const metadata = input.parsed.frontmatter;
  const name = stringValue(metadata.name) || (input.host === 'workbuddy' ? stringValue(metadata.title) : '');
  const description = stringValue(metadata.description) ||
    (input.host === 'workbuddy' ? stringValue(metadata.summary) : '');
  if (!input.parsed.hasFrontmatter) {
    diagnostics.push({
      code: 'frontmatter-missing',
      severity: 'error',
      title: '缺少 YAML 元数据',
      message: 'SKILL.md 顶部没有完整的 YAML frontmatter。'
    });
  }
  if (!name) {
    diagnostics.push({ code: 'name-missing', severity: 'error', title: '缺少内部名称', message: '未找到 name 字段。' });
  } else if (normalizeName(name) !== normalizeName(input.folderName)) {
    diagnostics.push({
      code: 'name-folder-mismatch',
      severity: 'warning',
      title: '名称与目录不一致',
      message: `内部名称“${name}”与目录“${input.folderName}”不同。`,
      params: { name, folderName: input.folderName }
    });
  }
  if (!description) {
    diagnostics.push({
      code: 'description-missing',
      severity: 'warning',
      title: '缺少说明',
      message: '没有可用于发现和触发此 Skill 的 description/summary。'
    });
  }
  if (input.host === 'workbuddy' && (!metadata.name || !metadata.description) && (metadata.title || metadata.summary)) {
    diagnostics.push({
      code: 'workbuddy-legacy-metadata',
      severity: 'info',
      title: 'WorkBuddy 旧式元数据',
      message: '当前使用 title/summary 兼容字段，保存时不会自动删除它们。'
    });
  }
  if (input.mainFileBytes > 200 * 1024) {
    diagnostics.push({
      code: 'main-file-large',
      severity: 'warning',
      title: '主文件较大',
      message: `SKILL.md 为 ${formatBytes(input.mainFileBytes)}，已超过默认 AI 附件上限。`,
      params: {
        sizeBytes: input.mainFileBytes,
        size: formatBytes(input.mainFileBytes),
        formattedSize: formatBytes(input.mainFileBytes)
      }
    });
  }
  if (input.hasScripts) {
    diagnostics.push({
      code: 'scripts-present',
      severity: 'info',
      title: '包含脚本',
      message: '工作台只盘点脚本，绝不会执行；v1 中脚本保持只读。'
    });
  }
  if (input.binaryCount > 0) {
    diagnostics.push({
      code: 'binary-present',
      severity: 'info',
      title: '包含二进制资源',
      message: `发现 ${input.binaryCount} 个二进制文件，不会发送给 AI。`,
      params: { count: input.binaryCount }
    });
  }
  if (input.agentMetadataError) {
    diagnostics.push({
      code: 'agent-metadata-invalid',
      severity: 'warning',
      title: 'Codex UI 元数据损坏',
      message: input.agentMetadataError,
      params: { error: input.agentMetadataError },
      relativePath: 'agents/openai.yaml'
    });
  }
  for (const broken of input.brokenLinks.slice(0, 20)) {
    diagnostics.push({
      code: broken.outside ? 'link-outside-skill' : 'link-missing',
      severity: broken.outside ? 'error' : 'warning',
      title: broken.outside ? '引用越过 Skill 目录' : '引用文件不存在',
      message: broken.outside ? `引用“${broken.path}”指向 Skill 目录之外。` : `找不到引用“${broken.path}”。`,
      params: { path: broken.path },
      relativePath: broken.path
    });
  }
  if (input.escapedSymlink) {
    diagnostics.push({
      code: 'symlink-outside-root',
      severity: 'error',
      title: '符号链接越界',
      message: 'Skill 的真实路径位于配置根目录之外，已强制设为只读。'
    });
  }
  return diagnostics;
}

export function healthFromDiagnostics(diagnostics: SkillDiagnostic[]): SkillHealth {
  if (diagnostics.some((item) => item.severity === 'error')) return 'error';
  if (diagnostics.some((item) => item.severity === 'warning')) return 'warning';
  return 'healthy';
}

export function severityRank(severity: DiagnosticSeverity): number {
  return severity === 'error' ? 3 : severity === 'warning' ? 2 : 1;
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/[\s_]+/g, '-');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function markdownLinks(body: string): string[] {
  const links: string[] = [];
  const expression = /(?:!?)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of body.matchAll(expression)) {
    const value = match[1];
    if (value) links.push(value.replace(/^<|>$/g, ''));
  }
  return links;
}

export function classifyFile(relativePath: string): 'main' | 'metadata' | 'reference' | 'asset' | 'script' | 'other' {
  const normalized = relativePath.replace(/\\/g, '/').toLocaleLowerCase('en-US');
  if (normalized === 'skill.md') return 'main';
  if (normalized === 'agents/openai.yaml' || normalized === 'agents/openai.yml') return 'metadata';
  if (normalized.startsWith('references/') || normalized.startsWith('reference/')) return 'reference';
  if (normalized.startsWith('scripts/') || /\.(?:js|mjs|cjs|ts|tsx|py|ps1|sh|bat|cmd|exe)$/i.test(normalized)) return 'script';
  if (normalized.startsWith('assets/') || /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|mp3|wav|mp4|mov|woff2?|ttf)$/i.test(normalized)) return 'asset';
  return 'other';
}

export function isTextFile(relativePath: string): boolean {
  const extension = path.extname(relativePath).toLocaleLowerCase('en-US');
  return ['.md', '.mdx', '.txt', '.yaml', '.yml', '.json', '.toml', '.xml', '.csv', '.tsv', '.html', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.ps1', '.sh'].includes(extension);
}
