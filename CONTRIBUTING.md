# Contributing to Skills Manager Pro

Thanks for helping improve SMP. Issues and pull requests are welcome when they keep the product local-first and preserve the safety boundaries around Skill files.

## Before opening an issue

1. Search existing issues and the [latest release](https://github.com/milu7/Skills-Manager-Pro/releases/latest).
2. State the SMP version, Windows version, installation type (installer or portable), and the affected host or Skill source.
3. Include repeatable steps, the expected result, and the actual result.
4. Remove API keys, authentication headers, private Skill contents, personal paths, and database files from logs or screenshots.

## Pull requests

- Keep each pull request focused and explain the user-facing effect.
- Do not weaken source writeability checks, snapshot/history behavior, atomic saves, or the rule that scripts are never automatically executed.
- Update documentation when a public behavior changes.
- Run the relevant checks before requesting review:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Windows packaging changes should additionally run `npm.cmd run make`, `npm.cmd run test:installer-startup`, and `npm.cmd run smoke:packaged`.

## Feature proposals

Describe the workflow problem before proposing a solution. Please include the host(s) involved, whether files must remain local, and how the change should respect source ownership and user confirmation.
