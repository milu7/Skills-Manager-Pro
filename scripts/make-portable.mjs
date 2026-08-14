import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const source = path.join(projectRoot, 'out', 'Skills Manager Pro-win32-x64');
const portableRoot = path.join(projectRoot, 'out', 'portable');
const target = path.join(portableRoot, `Skills-Manager-Pro-Portable-${packageJson.version}`);
const zipPath = path.join(portableRoot, `Skills-Manager-Pro-Portable-${packageJson.version}.zip`);

if (!fs.existsSync(path.join(source, 'SkillsManagerPro.exe'))) {
  throw new Error('找不到已打包的 SkillsManagerPro.exe，请先运行 npm.cmd run make');
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(portableRoot, { recursive: true });
fs.cpSync(source, target, { recursive: true });
fs.mkdirSync(path.join(target, 'data'), { recursive: true });
fs.writeFileSync(path.join(target, '启动便携版.cmd'), [
  '@echo off',
  'setlocal',
  'set "SKILL_WORKBENCH_USER_DATA=%~dp0data"',
  'start "Skills Manager Pro" "%~dp0SkillsManagerPro.exe"',
  'endlocal'
].join('\r\n') + '\r\n', 'utf8');

if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
// tar.exe avoids Compress-Archive's intermittent sharing violations on large
// Electron DLLs under Windows Defender/file indexing.
const archive = spawnSync('tar.exe', [
  '-a', '-c', '-f', zipPath, '-C', portableRoot, path.basename(target)
], { stdio: 'inherit' });
if (archive.status !== 0) throw new Error('便携 ZIP 压缩失败');
console.log(`Portable directory: ${target}`);
console.log(`Portable ZIP: ${zipPath}`);
