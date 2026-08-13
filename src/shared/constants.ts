export const SKILL_CATEGORIES = [
  '写作内容', '视觉设计', '开发工程', '自动化', '数据办公', '研究分析',
  '发布运营', '安全合规', '商业金融', '平台管理', '未分类'
] as const;

export const HOST_LABELS = {
  codex: 'Codex',
  claude: 'Claude',
  workbuddy: 'WorkBuddy',
  custom: '通用 / 自定义'
} as const;

export const SOURCE_LABELS = {
  user: '用户', project: '项目', plugin: '已安装插件', builtin: '内置',
  marketplace: '市场候选', cache: '缓存', trash: '回收站', backup: '备份'
} as const;
