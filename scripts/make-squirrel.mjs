import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import installer from 'electron-winstaller';

const { createWindowsInstaller } = installer;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const packagedApp = path.join(projectRoot, 'out', `${packageJson.productName}-win32-x64`);
const finalOutput = path.join(projectRoot, 'out', 'make', 'squirrel.windows', 'x64');
const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-manager-pro-squirrel-'));
const stagingApp = path.join(stagingRoot, 'app');
const stagingOutput = path.join(stagingRoot, 'output');

try {
  await fs.access(path.join(packagedApp, 'SkillWorkbench.exe'));
  // Squirrel's legacy resource editor cannot reliably load files from paths
  // containing CJK characters. Keep all of its inputs and outputs in an ASCII
  // temporary path, then copy only the finished artifacts back to the project.
  await fs.cp(packagedApp, stagingApp, { recursive: true });
  await createWindowsInstaller({
    appDirectory: stagingApp,
    outputDirectory: stagingOutput,
    name: 'skills_manager_pro',
    title: 'Skills Manager Pro',
    authors: packageJson.author,
    owners: packageJson.author,
    description: '本地 Skill 管理、分析与安全编辑工作台',
    version: packageJson.version,
    exe: 'SkillsManagerPro.exe',
    setupExe: 'Skills-Manager-Pro-Setup.exe',
    noMsi: true,
    noDelta: true,
    usePackageJson: false
  });
  await fs.rm(finalOutput, { recursive: true, force: true });
  await fs.mkdir(path.dirname(finalOutput), { recursive: true });
  await fs.cp(stagingOutput, finalOutput, { recursive: true });
  const artifacts = (await fs.readdir(finalOutput)).sort();
  console.log(`Squirrel artifacts: ${artifacts.join(', ')}`);
} finally {
  await fs.rm(stagingRoot, { recursive: true, force: true });
}
