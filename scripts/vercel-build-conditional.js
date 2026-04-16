#!/usr/bin/env node
'use strict';
/**
 * Vercel build: if VERCEL_ADMIN_ONLY is set (Admin-only project), run only Next build.
 * Otherwise run full monorepo build (prisma, API, then Next).
 */
const { execSync } = require('child_process');
const path = require('path');

const isAdminOnly = process.env.VERCEL_ADMIN_ONLY === '1' || process.env.VERCEL_ADMIN_ONLY === 'true';

if (isAdminOnly) {
  execSync('npm run build:admin', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} else {
  execSync('npm run build:monorepo', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}
