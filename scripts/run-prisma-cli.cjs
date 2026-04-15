'use strict';

/**
 * Runs the Prisma CLI from the installed `prisma` package (any hoisted path).
 * Used from postinstall / npm scripts so hard-coded ./node_modules/prisma/... works on Vercel and other layouts.
 *
 * Usage: node scripts/run-prisma-cli.cjs generate --schema=apps/api/src/infra/prisma/schema.prisma
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PINNED_PRISMA = 'prisma@6.19.2';

function resolvePrismaEntry() {
  const bases = [
    root,
    path.join(root, 'apps', 'admin-web'),
    path.join(root, 'apps', 'api'),
  ];
  for (const b of bases) {
    try {
      const resolved = require.resolve('prisma/build/index.js', { paths: [b] });
      if (fs.existsSync(resolved)) return resolved;
    } catch (_) {
      /* continue */
    }
  }
  const flat = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  if (fs.existsSync(flat)) return flat;
  return null;
}

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/run-prisma-cli.cjs <prisma-args...>');
  process.exit(1);
}

const entry = resolvePrismaEntry();
if (entry) {
  const r = spawnSync(process.execPath, [entry, ...prismaArgs], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(r.status === null ? 1 : r.status);
}

console.warn(
  `[run-prisma-cli] Could not resolve prisma package under ${root}; running npx ${PINNED_PRISMA} (pin avoids Prisma 7).`,
);
const r = spawnSync('npx', [PINNED_PRISMA, ...prismaArgs], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(r.status === null ? 1 : r.status);
