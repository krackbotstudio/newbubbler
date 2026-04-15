'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  RESET_ALL_CONFIRM: 'YES',
};

const args = [
  'ts-node',
  '--transpile-only',
  '--project',
  'scripts/tsconfig.seed.json',
  'scripts/reset-all-data.ts',
];

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  cwd: root,
  env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
