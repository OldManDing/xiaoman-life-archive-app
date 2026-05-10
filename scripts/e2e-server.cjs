const { spawn } = require('node:child_process');

const { apiEnv, frontendEnv, webPort, adminPort } = require('./e2e-env.cjs');

const target = process.argv[2];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const servers = {
  api: {
    args: ['run', 'start:api'],
    env: apiEnv,
  },
  web: {
    args: ['run', 'dev', '-w', 'apps/web', '--', '--host', '127.0.0.1', '--port', webPort, '--strictPort'],
    env: frontendEnv,
  },
  admin: {
    args: ['run', 'dev', '-w', 'apps/admin', '--', '--host', '127.0.0.1', '--port', adminPort, '--strictPort'],
    env: frontendEnv,
  },
};

const config = servers[target];

if (!config) {
  console.error(`Unknown E2E server target: ${target}`);
  process.exit(1);
}

const child = spawn(npmCommand, config.args, {
  cwd: process.cwd(),
  env: config.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

function stopChild() {
  if (!child.killed) {
    child.kill(process.platform === 'win32' ? 'SIGTERM' : 'SIGINT');
  }
}

process.on('SIGINT', stopChild);
process.on('SIGTERM', stopChild);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
