/**
 * Vercel serverless entry for Bubbler API.
 * Registers path aliases then loads the built Nest handler.
 * Used when deploying the API as a Vercel project (root = repo root).
 */
const path = require('path');
const tsConfigPaths = require('tsconfig-paths');

const repoRoot = path.join(__dirname, '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');

tsConfigPaths.register({
  baseUrl: apiRoot,
  paths: {
    '@prisma/client': ['src/infra/generated/prisma-client'],
    '@prisma/client/*': ['src/infra/generated/prisma-client/*'],
    '@shared/*': ['../../packages/shared/src/*'],
  },
});

const handlerPath = path.join(apiRoot, 'dist', 'apps', 'api', 'src', 'bootstrap', 'vercel-handler.js');
const handlerModule = require(handlerPath);
const handler = handlerModule.default || handlerModule;

// Vercel rewrite sends /api/* to /api/index/:path — restore path so Nest sees /api/...
const INDEX_PREFIX = '/api/index';
function runHandler(req, res) {
  if (req.url && req.url.startsWith(INDEX_PREFIX)) {
    const rest = req.url.slice(INDEX_PREFIX.length);
    req.url = '/api' + (rest.startsWith('/') ? rest : rest || '');
  }
  return handler(req, res);
}

// Export for all methods so Vercel routes GET, POST, PUT, PATCH, DELETE, OPTIONS to this function
module.exports = runHandler;
module.exports.get = runHandler;
module.exports.post = runHandler;
module.exports.put = runHandler;
module.exports.patch = runHandler;
module.exports.delete = runHandler;
module.exports.options = runHandler;
