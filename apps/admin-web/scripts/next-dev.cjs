'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const adminRoot = path.resolve(__dirname, '..');
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true';
// Next 16 defaults to Turbopack in dev; force webpack to avoid local Turbopack panic.

const result = spawnSync('npx', ['next', 'dev', '--webpack', '-p', '3004'], {
  stdio: 'inherit',
  cwd: adminRoot,
  env: process.env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
