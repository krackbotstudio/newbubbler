'use strict';

/**
 * Runs a command with apps/api/.env merged into the child environment, plus
 * DOTENV_CONFIG_PATH + TS_NODE_PROJECT for tools that read those (e.g. ts-node).
 *
 * Prisma CLI does not read DOTENV_CONFIG_PATH — it needs DATABASE_URL in the
 * actual env, so we parse apps/api/.env here (same source as dev:api).
 * Parsing is inlined so `npm install` postinstall does not depend on `dotenv`.
 *
 * Usage: node scripts/spawn-with-api-env.cjs node scripts/run-prisma-cli.cjs migrate deploy --schema=apps/api/src/infra/prisma/schema.prisma
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Minimal .env parser (no dotenv package) so postinstall works when node_modules is not fully linked yet. */
function parseEnvFile(contents) {
  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const body = t.startsWith('export ') ? t.slice(7).trimStart() : t;
    const eq = body.indexOf('=');
    if (eq === -1) continue;
    const key = body.slice(0, eq).trim();
    if (!key) continue;
    let val = body.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const cmd = process.argv.slice(2);

if (cmd.length === 0) {
  console.error('Usage: node scripts/spawn-with-api-env.cjs <command> [args...]');
  process.exit(1);
}

const apiEnvPath = path.join(root, 'apps', 'api', '.env');
let fromApiEnv = {};
try {
  fromApiEnv = parseEnvFile(fs.readFileSync(apiEnvPath, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.warn(`[spawn-with-api-env] Could not read ${apiEnvPath}: ${e.message}`);
  }
}

const env = {
  ...process.env,
  ...fromApiEnv,
  DOTENV_CONFIG_PATH: 'apps/api/.env',
  TS_NODE_PROJECT: 'apps/api/tsconfig.json',
};
// Optional: set PRISMA_ENGINES_MIRROR if downloads from binaries.prisma.sh fail on your network.

const result = spawnSync(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  cwd: root,
  env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
