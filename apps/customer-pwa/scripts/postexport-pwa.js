/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
  return true;
}

const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(distDir)) {
  console.error(`[postexport-pwa] dist folder missing: ${distDir}`);
  process.exit(1);
}

// Use the same branding assets from the mobile app.
const mobileAssets = path.join(appRoot, '..', 'customer-mobile', 'assets');

// Best-effort: include icons for install banners.
copyIfExists(path.join(mobileAssets, 'icon.png'), path.join(distDir, 'icon-192.png'));
copyIfExists(path.join(mobileAssets, 'icon.png'), path.join(distDir, 'icon-512.png'));
// favicon.ico already exists in dist from expo export.

const manifest = {
  name: 'Weyou Customer',
  short_name: 'Weyou',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#7a2d7a',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
  ],
};

const manifestPath = path.join(distDir, 'manifest.json');
writeText(manifestPath, JSON.stringify(manifest, null, 2));

const swPath = path.join(distDir, 'sw.js');
// Simple cache strategy for GET requests from same origin.
const sw = `/* eslint-disable no-restricted-globals */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function isGet(req) {
  return req && req.method === 'GET';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isGet(req)) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open('weyou-pwa-v1').then(async (cache) => {
      const cached = await cache.match(req, { ignoreVary: true });
      if (cached) return cached;

      const fresh = await fetch(req);
      // Cache successful responses only.
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    }).catch(() => fetch(req))
  );
});
`;
writeText(swPath, sw);

// Patch index.html to include manifest + SW registration.
let indexHtml = readText(indexPath);
if (!indexHtml) {
  console.error(`[postexport-pwa] index.html missing at ${indexPath}`);
  process.exit(1);
}

const hasManifestLink = indexHtml.includes('rel="manifest"') || indexHtml.includes('manifest.json');
if (!hasManifestLink) {
  indexHtml = indexHtml.replace(
    /<link rel="icon"[^>]*\/>\s*/m,
    (m) => `${m}\n  <link rel="manifest" href="/manifest.json" />\n  <meta name="theme-color" content="#7a2d7a" />\n`
  );
  if (indexHtml === readText(indexPath)) {
    // Fallback: insert before closing </head>.
    indexHtml = indexHtml.replace('</head>', '  <link rel="manifest" href="/manifest.json" />\n  <meta name="theme-color" content="#7a2d7a" />\n</head>');
  }
}

const hasSwRegister = indexHtml.includes('serviceWorker') && indexHtml.includes('sw.js');
if (!hasSwRegister) {
  indexHtml = indexHtml.replace(
    /<\/body>\s*/m,
    `  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function (e) {
          // Silent: SW may be blocked on non-HTTPS in some environments.
          console.warn('SW register failed', e);
        });
      });
    }
  </script>
</body>`
  );
}

writeText(indexPath, indexHtml);

console.log('[postexport-pwa] PWA files generated in dist/');
