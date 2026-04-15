'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const adminRoot = path.resolve(__dirname, '..');
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true';

const result = spawnSync('npx', ['next', 'dev', '-p', '3004'], {
  stdio: 'inherit',
  cwd: adminRoot,
  env: process.env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
