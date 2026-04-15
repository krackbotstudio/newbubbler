/**
 * Runs `npm install` with Prisma engine download settings that often fix
 * ECONNRESET / TLS abort during @prisma/engines postinstall on Windows.
 *
 * Usage (repo root): node scripts/npm-install-with-prisma-mirror.js
 * Or: npm run install:with-prisma-mirror
 */
const { spawnSync } = require('child_process');

const env = { ...process.env };
// If engine downloads fail, set PRISMA_ENGINES_MIRROR yourself (see Prisma docs) and re-run.

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const extraArgs = process.argv.slice(2);
const args = ['install', ...extraArgs];

const result = spawnSync(npmCmd, args, {
  stdio: 'inherit',
  env,
  shell: false,
});

process.exit(result.status === null ? 1 : result.status);
