/** Local AI tool locations imported from the supplied adapter catalogue. */
export interface AiToolLocation { key: string; displayName: string; skillsDir: string; detectDir: string; }

const RAW_AI_TOOL_LOCATIONS: Array<[string, string, string, string]> = [
  ['cursor', 'Cursor', '.cursor/skills', '.cursor'], ['claude_code', 'Claude Code', '.claude/skills', '.claude'],
  ['omp_agent', 'OMP Agent', '.omp/agent/skills', '.omp/agent'], ['codex', 'Codex', '.codex/skills', '.codex'],
  ['grok', 'Grok', '.grok/skills', '.grok'], ['opencode', 'OpenCode', '.config/opencode/skills', '.config/opencode'],
  ['antigravity', 'Antigravity', '.gemini/antigravity/skills', '.gemini/antigravity'], ['amp', 'Amp', '.config/agents/skills', '.config/agents'],
  ['kilo_code', 'Kilo Code', '.kilocode/skills', '.kilocode'], ['roo_code', 'Roo Code', '.roo/skills', '.roo'],
  ['goose', 'Goose', '.config/goose/skills', '.config/goose'], ['gemini_cli', 'Gemini CLI', '.gemini/skills', '.gemini'],
  ['github_copilot', 'GitHub Copilot', '.copilot/skills', '.copilot'], ['openclaw', 'OpenClaw', '.openclaw/skills', '.openclaw'],
  ['droid', 'Droid', '.factory/skills', '.factory'], ['windsurf', 'Windsurf', '.codeium/windsurf/skills', '.codeium/windsurf'],
  ['trae', 'TRAE IDE', '.trae/skills', '.trae'], ['cline', 'Cline', '.agents/skills', '.cline'],
  ['deepagents', 'Deep Agents', '.deepagents/agent/skills', '.deepagents'], ['firebender', 'Firebender', '.firebender/skills', '.firebender'],
  ['kimi', 'Kimi Code CLI', '.config/agents/skills', '.kimi'], ['replit', 'Replit', '.config/agents/skills', '.replit'],
  ['warp', 'Warp', '.agents/skills', '.warp'], ['augment', 'Augment', '.augment/skills', '.augment'],
  ['bob', 'IBM Bob', '.bob/skills', '.bob'], ['codebuddy', 'CodeBuddy', '.codebuddy/skills', '.codebuddy'],
  ['command_code', 'Command Code', '.commandcode/skills', '.commandcode'], ['continue', 'Continue', '.continue/skills', '.continue'],
  ['cortex', 'Cortex Code', '.snowflake/cortex/skills', '.snowflake/cortex'], ['crush', 'Crush', '.config/crush/skills', '.config/crush'],
  ['iflow', 'iFlow CLI', '.iflow/skills', '.iflow'], ['junie', 'Junie', '.junie/skills', '.junie'],
  ['kiro', 'Kiro CLI', '.kiro/skills', '.kiro'], ['kode', 'Kode', '.kode/skills', '.kode'],
  ['mcpjam', 'MCPJam', '.mcpjam/skills', '.mcpjam'], ['mistral_vibe', 'Mistral Vibe', '.vibe/skills', '.vibe'],
  ['mux', 'Mux', '.mux/skills', '.mux'], ['neovate', 'Neovate', '.neovate/skills', '.neovate'],
  ['openhands', 'OpenHands', '.openhands/skills', '.openhands'], ['pi', 'Pi', '.pi/agent/skills', '.pi/agent'],
  ['pochi', 'Pochi', '.pochi/skills', '.pochi'], ['qoder', 'Qoder', '.qoder/skills', '.qoder'],
  ['qwen_code', 'Qwen Code', '.qwen/skills', '.qwen'],
  // TRAE CN has no flat ~/.trae-cn/skills directory. Its installed Skills
  // live in separate read-only roots so the workbench can preserve origin.
  ['trae_cn_builtin', 'TRAE CN 内置', '.trae-cn/builtin', '.trae-cn/builtin'],
  ['trae_cn_builtin_skills', 'TRAE CN 内置扩展', '.trae-cn/builtin_skills', '.trae-cn/builtin_skills'],
  ['trae_cn_plugins', 'TRAE CN 插件', '.trae-cn/plugins', '.trae-cn/plugins'],
  ['zencoder', 'Zencoder', '.zencoder/skills', '.zencoder'], ['adal', 'AdaL', '.adal/skills', '.adal'],
  ['hermes', 'Hermes Agent', '.hermes/skills', '.hermes'], ['qclaw', 'QClaw', '.qclaw/skills', '.qclaw'],
  ['easyclaw', 'EasyClaw', '.easyclaw/skills', '.easyclaw'], ['autoclaw', 'AutoClaw', '.openclaw-autoclaw/skills', '.openclaw-autoclaw'],
  ['workbuddy', 'WorkBuddy', '.workbuddy/skills', '.workbuddy']
];

export const AI_TOOL_LOCATIONS: AiToolLocation[] = RAW_AI_TOOL_LOCATIONS.map(([key, displayName, skillsDir, detectDir]) => ({ key, displayName, skillsDir, detectDir }));

export const AI_TOOL_BY_NAME = new Map(AI_TOOL_LOCATIONS.map((tool) => [tool.displayName.toLocaleLowerCase('en-US'), tool]));
