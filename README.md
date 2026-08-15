# Skills Manager Pro

<p align="center">
  <strong>A local-first, Windows-native manager for AI agent Skills.</strong><br>
  Discover, inspect, organize, and safely maintain Skills from Codex, Claude Code, WorkBuddy, and custom folders — without moving them into another system.
</p>

<p align="center">
  <a href="https://github.com/milu7/Skills-Manager-Pro/releases/latest">Download for Windows</a>
  &nbsp;·&nbsp;
  <a href="README.zh-CN.md">简体中文</a>
  &nbsp;·&nbsp;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/milu7/Skills-Manager-Pro/releases/latest"><img src="https://img.shields.io/github/v/release/milu7/Skills-Manager-Pro?display_name=tag&sort=semver" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/milu7/Skills-Manager-Pro" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4" alt="Windows 10 or 11 x64">
  <img src="https://img.shields.io/badge/built%20with-TypeScript-3178C6" alt="Built with TypeScript">
</p>

Skills are easy to accumulate and surprisingly hard to maintain. They live across personal folders, projects, plugins, caches, and marketplaces — with different ownership, safety constraints, and formats. Skills Manager Pro (SMP) gives those files one local workspace while keeping each Skill in its original location.

## What makes SMP useful

| See what you have | Change only what is safe | Keep a way back |
| --- | --- | --- |
| Discover multiple hosts and custom roots, then search by name, description, content, path, source, health, or writeability. | Inspect YAML, Markdown, references, scripts, binaries, duplicate signals, and source permissions before editing. | Review diffs before save, preserve snapshots and operation history, and restore managed Skills from the workspace recycle bin. |

- **One local index, many sources.** Codex, Claude Code, WorkBuddy, project folders, plugins, built-ins, marketplaces, caches, backups, and custom roots remain distinguishable.
- **A real maintenance workspace.** Edit supported Markdown, structured metadata, and text resources; separate display-name changes from internal renames; inspect likely self-references before a rename.
- **Local-first safety boundaries.** Protected sources are read-only by default. Saves use an atomic replacement and refuse to overwrite an externally changed file.
- **Useful diagnosis without executing Skills.** SMP checks structure, YAML, references, file sizes, scripts/binaries, links, duplicate candidates, and path risks. It inventories scripts; it does not run them.
- **Optional AI analysis under your control.** AI work is manual, previews the content to be sent, defaults to `SKILL.md`, excludes scripts and binaries, and never auto-rewrites a Skill.

## Product tour

The screenshots show core workflows. Minor labels may differ between releases.

<p align="center">
  <a href="docs/images/software-preview/overview.png">
    <img src="docs/images/software-preview/overview.png" alt="Skills Manager Pro overview with a unified Skill index, source filters, and detail pane" width="100%">
  </a><br>
  <sub>One index for Skills across hosts, with source, health, and writeability context.</sub>
</p>

| Editable Skill and content preview | Local safety diagnostics |
| --- | --- |
| <a href="docs/images/software-preview/editable-skill.png"><img src="docs/images/software-preview/editable-skill.png" alt="Editable Skill with Markdown content preview"></a> | <a href="docs/images/software-preview/diagnostics.png"><img src="docs/images/software-preview/diagnostics.png" alt="Local Skill diagnostics and actionable warnings"></a> |
| **Exact and near-duplicate signals** | **Structured metadata editing** |
| <a href="docs/images/software-preview/duplicates.png"><img src="docs/images/software-preview/duplicates.png" alt="Duplicate Skill detection"></a> | <a href="docs/images/software-preview/structured-editor.png"><img src="docs/images/software-preview/structured-editor.png" alt="Structured Skill metadata editor"></a> |

<p align="center">
  <a href="docs/images/software-preview/image-notes.png">
    <img src="docs/images/software-preview/image-notes.png" alt="Markdown notes with image attachments and live preview" width="100%">
  </a><br>
  <sub>Keep personal usage notes separate from the original Skill files.</sub>
</p>

## Download and run

SMP currently supports **Windows 10/11 x64** and is designed for a single local user.

1. Open the [latest release](https://github.com/milu7/Skills-Manager-Pro/releases/latest).
2. Choose **`Skills-Manager-Pro-Setup.exe`** to install, or **`Skills-Manager-Pro-Portable-0.2.1.zip`** for a portable copy.
3. Extract the portable ZIP before running `启动便携版.cmd`. Its data stays beside the app in the `data` folder.

The app is not code-signed yet, so Windows may show a publisher or SmartScreen warning. Download only from this repository’s Releases page and verify the accompanying `SHA256SUMS.txt` when needed.

## Local-first data and safety

- Your Skill files remain at their original paths. SMP stores a local index, categories, tags, snapshots, history, and optional AI results in `%APPDATA%\Skills Manager Pro`.
- User and project sources can be editable; plugin, built-in, marketplace, cache, and backup sources are protected by default.
- A save presents a diff, creates a snapshot, and uses a same-directory temporary file with atomic replacement. A changed-on-disk hash blocks accidental overwrite.
- Managed removal goes to the workspace recycle bin; there is no permanent-delete entry point in the app.
- API keys and custom sensitive headers are encrypted with Electron `safeStorage`; plaintext keys are not returned to the UI or IPC layer.

Read more about [architecture and safety boundaries](docs/架构与安全边界.md) and [backup and recovery](docs/数据备份与恢复.md).

## Scope and non-goals

SMP does not currently provide accounts, cloud sync, team permissions, a Skill marketplace installer, forced plugin uninstall, Git auto-update, script execution, automatic AI rewriting, code signing, or verified macOS/Linux releases. It is a local management tool, not an unattended automation service.

## Development

Requires Node.js 24+ on Windows PowerShell.

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

`npm.cmd run make` creates the Windows package and Squirrel installer. `npm.cmd run make:portable` creates a ZIP with a data directory beside the executable. The installer build stages through an ASCII-only temporary directory because legacy Windows resource tooling can be unreliable with Chinese project paths.

## Contributing

Bug reports, focused feature proposals, and documentation improvements are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), search existing issues, and keep diagnostics free of API keys, personal paths, or private Skill content.

## License

Released under the [MIT License](LICENSE).

Product and company names such as Codex, Claude Code, and WorkBuddy belong to their respective owners. Skills Manager Pro is an independent tool and is not affiliated with or endorsed by those products’ owners.
