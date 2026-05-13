const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const { apiEnv } = require('./e2e-env.cjs');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const prismaClientPath = join(process.cwd(), 'node_modules', '.prisma', 'client', 'index.js');

function run(args, env = process.env) {
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(prismaClientPath)) {
  run(['run', 'prisma:generate'], apiEnv);
} else {
  console.info('Prisma Client already exists; skipping generate for E2E prepare.');
}

run(['run', 'build:api'], apiEnv);
run(['run', 'prisma:dbpush:skip-generate', '-w', 'apps/api'], apiEnv);
run(['run', 'prisma:seed'], apiEnv);
