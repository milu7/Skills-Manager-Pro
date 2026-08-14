# Skills Manager Pro

<p align="center">
  <strong>面向 AI Agent Skill 的 Windows 本地管理工作台。</strong><br>
  统一发现、检查、整理与安全维护 Codex、Claude Code、WorkBuddy 和自定义目录中的 Skill，同时保留原始文件位置。
</p>

<p align="center">
  <a href="https://github.com/milu7/Skills-Manager-Pro/releases/latest">下载 Windows 版</a>
  &nbsp;·&nbsp;
  <a href="README.md">English</a>
  &nbsp;·&nbsp;
  <a href="#参与贡献">参与贡献</a>
</p>

<p align="center">
  <a href="https://github.com/milu7/Skills-Manager-Pro/releases/latest"><img src="https://img.shields.io/github/v/release/milu7/Skills-Manager-Pro?display_name=tag&sort=semver" alt="最新版本"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/milu7/Skills-Manager-Pro" alt="MIT 许可证"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4" alt="Windows 10 或 11 x64">
  <img src="https://img.shields.io/badge/built%20with-TypeScript-3178C6" alt="使用 TypeScript 构建">
</p>

Skill 越积越多，越难维护。个人目录、项目、插件、缓存和市场里会出现不同来源、权限和格式的 Skill。Skills Manager Pro，简称 SMP，为这些分散文件建立一个本地工作台，但不会把它们迁移到新的系统中。

## SMP 解决什么问题

| 看清现状 | 只改该改的内容 | 始终保留退路 |
| --- | --- | --- |
| 自动发现多个宿主和自定义扫描根，按名称、说明、正文、路径、来源、健康状态和可编辑性查找。 | 编辑前查看 YAML、Markdown、references、脚本、二进制、重复信号和来源权限。 | 保存前确认差异，保留文本快照与操作历史，并可从工作台回收站恢复受管理的 Skill。 |

- **一个本地索引，保留每个来源。** Codex、Claude Code、WorkBuddy、项目目录、插件、内置、市场、缓存、备份和自定义目录不会混成同一类文件。
- **真正面向维护的工作台。** 可编辑受支持的 Markdown、结构化元数据和文本资源；显示名与内部名分开处理，内部改名前会检查目录、已知宿主元数据和自引用。
- **本地优先的安全边界。** 受保护来源默认只读。保存采用原子替换，文件已被外部修改时不会直接覆盖。
- **不执行 Skill 的诊断。** SMP 会检查结构、YAML、引用、文件体积、脚本/二进制、链接、重复候选和路径风险。脚本只会被盘点，不会自动运行。
- **由你控制的 AI 分析。** AI 分析必须手动触发，会先预览发送内容，默认只发送 `SKILL.md`，排除脚本和二进制，也不会自动改写 Skill。

## 软件预览

下列截图展示核心工作流，少量界面文字会随版本更新而变化。

<p align="center">
  <a href="docs/images/software-preview/overview.png">
    <img src="docs/images/software-preview/overview.png" alt="Skills Manager Pro 统一 Skill 索引、来源筛选与详情面板" width="100%">
  </a><br>
  <sub>跨宿主 Skill 的统一索引，并保留来源、健康状态与可编辑性上下文。</sub>
</p>

| 可编辑 Skill 与内容预览 | 本地安全诊断 |
| --- | --- |
| <a href="docs/images/software-preview/editable-skill.png"><img src="docs/images/software-preview/editable-skill.png" alt="可编辑 Skill 的 Markdown 内容预览"></a> | <a href="docs/images/software-preview/diagnostics.png"><img src="docs/images/software-preview/diagnostics.png" alt="Skill 本地诊断与可操作提示"></a> |
| **精确与近似重复信号** | **结构化元数据编辑** |
| <a href="docs/images/software-preview/duplicates.png"><img src="docs/images/software-preview/duplicates.png" alt="Skill 重复项检测"></a> | <a href="docs/images/software-preview/structured-editor.png"><img src="docs/images/software-preview/structured-editor.png" alt="Skill 结构化元数据编辑器"></a> |

<p align="center">
  <a href="docs/images/software-preview/image-notes.png">
    <img src="docs/images/software-preview/image-notes.png" alt="带图片附件和实时预览的 Markdown 备注" width="100%">
  </a><br>
  <sub>将个人使用经验与原始 Skill 文件分离保存。</sub>
</p>

## 下载与运行

当前版本支持 **Windows 10/11 x64**，适用于单机单用户。

1. 打开[最新 Release](https://github.com/milu7/Skills-Manager-Pro/releases/latest)。
2. 选择 **`Skills-Manager-Pro-Setup.exe`** 安装，或下载 **`Skills-Manager-Pro-Portable-0.2.1.zip`** 使用便携版。
3. 请先解压便携 ZIP，再运行其中的 `启动便携版.cmd`。数据会保存在程序旁边的 `data` 目录。

应用暂未进行代码签名，Windows 可能显示发布者或 SmartScreen 提示。请只从本仓库的 Releases 页面下载，必要时使用随附的 `SHA256SUMS.txt` 校验文件。

## 本地数据与安全边界

- 原 Skill 文件保留在原始路径。SMP 在 `%APPDATA%\Skill 管理工作台` 保存本地索引、分类、标签、快照、历史和可选 AI 分析结果。
- 用户与项目来源通常可编辑；插件、内置、市场、缓存和备份来源默认受保护。
- 保存前会展示差异、创建快照，并通过同目录临时文件原子替换。磁盘哈希不一致时会阻止误覆盖。
- 受管理的移除操作会进入工作台回收站，软件内没有永久删除入口。
- API Key 和自定义敏感请求头会经过 Electron `safeStorage` 加密；明文密钥不会返回到界面或 IPC 层。

更多实现细节见[架构与安全边界](docs/架构与安全边界.md)与[数据备份与恢复](docs/数据备份与恢复.md)。

## 当前范围

SMP 尚未提供账号、云同步、团队权限、Skill 市场安装、插件强制卸载、Git 自动更新、脚本执行、AI 自动改写、代码签名，以及经过发布验证的 macOS/Linux 版本。它是一个本地管理工具，不是无人值守自动化服务。

## 开发与验证

需要 Windows PowerShell 与 Node.js 24+。

```powershell
npm.cmd install
npm.cmd start
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run make
npm.cmd run make:portable
npm.cmd run test:installer-startup
npm.cmd run smoke:packaged
```

`npm.cmd run make` 会构建 Windows 包和 Squirrel 安装器。`npm.cmd run make:portable` 会生成数据目录与可执行文件相邻的便携 ZIP。因为旧版 Windows 资源工具对中文项目路径兼容性不稳定，安装器会经由纯英文临时目录构建。

## 参与贡献

欢迎提交 Bug、明确的功能建议与文档改进。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，先搜索已有 Issue，并务必从诊断信息中移除 API Key、个人路径和私有 Skill 内容。

## 许可证

本项目采用 [MIT License](LICENSE)。

Codex、Claude Code、WorkBuddy 等产品和公司名称归其各自权利人所有。Skills Manager Pro 是独立工具，未获得这些产品或其权利人的关联、认可或背书。
