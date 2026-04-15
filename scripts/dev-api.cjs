'use strict';

/**
 * Starts the API with apps/api/.env + tsconfig.
 * Uses Node --watch + ts-node (Node 18+). If Prisma Client is missing, runs
 * `prisma generate` once first (same as postinstall).
 *
 * Optional port: node scripts/dev-api.cjs 3003
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiEnvPath = path.join(root, 'apps', 'api', '.env');
const env = {
  ...process.env,
  // Absolute path so dotenv always finds the file regardless of cwd quirks.
  DOTENV_CONFIG_PATH: apiEnvPath,
  TS_NODE_PROJECT: 'apps/api/tsconfig.json',
  TS_NODE_TRANSPILE_ONLY: 'true',
};
const port = process.argv[2];
if (port) {
  env.PORT = port;
}

const prismaClientIndex = path.join(
  root,
  'apps',
  'api',
  'src',
  'infra',
  'generated',
  'prisma-client',
  'index.js'
);

function ensurePrismaClient() {
  if (fs.existsSync(prismaClientIndex)) {
    return true;
  }
  // eslint-disable-next-line no-console
  console.log('Prisma client not found; running prisma generate…');
  const gen = spawnSync('npx', ['prisma', 'generate', '--schema=apps/api/src/infra/prisma/schema.prisma'], {
    stdio: 'inherit',
    cwd: root,
    env,
    shell: true,
  });
  if (gen.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(
      '\nprisma generate failed. Ensure apps/api/.env has a valid DATABASE_URL, then run:\n  npm run prisma:generate\n'
    );
    process.exit(gen.status ?? 1);
  }
  return fs.existsSync(prismaClientIndex);
}

if (!ensurePrismaClient()) {
  // eslint-disable-next-line no-console
  console.error('Prisma client still missing after generate. Run: npm run prisma:generate');
  process.exit(1);
}

const mainRel = path.join('apps', 'api', 'src', 'bootstrap', 'main.ts');
const args = [
  '--watch',
  '-r',
  'tsconfig-paths/register',
  '-r',
  'ts-node/register',
  mainRel,
];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: root,
  env,
  shell: false,
});

process.exit(result.status === null ? 1 : result.status);
