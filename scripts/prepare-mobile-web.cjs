const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'apps', 'web', 'dist');
const targetDir = path.join(repoRoot, 'apps', 'mobile', 'www');
const mobileApiBaseUrl = process.env.VITE_MOBILE_API_BASE_URL ?? 'https://webapi.xmlga.top/api/v1';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const buildResult = spawnSync(npmCommand, ['run', 'build', '-w', 'apps/web'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_API_BASE_URL: mobileApiBaseUrl,
  },
});

if (buildResult.error) {
  console.error(buildResult.error);
  process.exit(1);
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!fs.existsSync(sourceDir)) {
  throw new Error('apps/web/dist does not exist after the mobile web build');
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Mobile web assets prepared with ${mobileApiBaseUrl}: ${targetDir}`);
