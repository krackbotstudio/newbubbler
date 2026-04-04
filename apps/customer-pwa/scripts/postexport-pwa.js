/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');
const mobileRoot = path.join(appRoot, '..', 'customer-mobile');
const mobileAssets = path.join(mobileRoot, 'assets');
const repoRoot = path.join(appRoot, '..', '..');

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

function readEnvVar(envPath, key) {
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '').split('#')[0].trim();
}

function normalizeApiRoot(raw) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '');
  return trimmed.replace(/\/api\/?$/, '');
}

/**
 * Same source as mobile `update-icon-from-branding.js`: public branding `appIconUrl`, else `logoUrl`.
 * Returns image buffer or null (offline / missing config / failure).
 */
async function fetchBrandingAppIconBuffer() {
  const pwaEnv = path.join(appRoot, '.env');
  const mobileEnv = path.join(mobileRoot, '.env');
  const rootEnv = path.join(repoRoot, '.env');
  let API_BASE =
    readEnvVar(mobileEnv, 'EXPO_PUBLIC_API_URL') ||
    readEnvVar(pwaEnv, 'EXPO_PUBLIC_API_URL') ||
    readEnvVar(rootEnv, 'EXPO_PUBLIC_API_URL') ||
    process.env.EXPO_PUBLIC_API_URL ||
    '';
  if (!API_BASE) {
    console.warn('[postexport-pwa] No EXPO_PUBLIC_API_URL; skipping live branding favicon fetch.');
    return null;
  }
  const base = normalizeApiRoot(API_BASE);
  const brandingUrl = `${base}/api/branding/public`;
  let res;
  try {
    res = await fetch(brandingUrl);
  } catch (e) {
    console.warn('[postexport-pwa] Branding fetch failed:', e.message);
    return null;
  }
  if (!res.ok) {
    console.warn(`[postexport-pwa] GET ${brandingUrl} returned ${res.status}`);
    return null;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const iconUrl = data && (data.appIconUrl || data.logoUrl);
  if (!iconUrl || !String(iconUrl).trim()) {
    console.warn('[postexport-pwa] No appIconUrl or logoUrl in branding response.');
    return null;
  }
  let fullUrl = String(iconUrl).trim();
  if (!fullUrl.startsWith('http')) {
    fullUrl = `${base}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
  }
  let imgRes;
  try {
    imgRes = await fetch(fullUrl);
  } catch (e) {
    console.warn('[postexport-pwa] Icon download failed:', e.message);
    return null;
  }
  if (!imgRes.ok) {
    console.warn(`[postexport-pwa] Icon GET ${fullUrl} returned ${imgRes.status}`);
    return null;
  }
  return Buffer.from(await imgRes.arrayBuffer());
}

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error(`[postexport-pwa] dist folder missing: ${distDir}`);
    process.exit(1);
  }

  const brandingBuf = await fetchBrandingAppIconBuffer();
  let havePngFavicon = false;

  if (brandingBuf) {
    ensureDir(distDir);
    fs.writeFileSync(path.join(distDir, 'icon-192.png'), brandingBuf);
    fs.writeFileSync(path.join(distDir, 'icon-512.png'), brandingBuf);
    fs.writeFileSync(path.join(distDir, 'favicon.png'), brandingBuf);
    havePngFavicon = true;
    console.log('[postexport-pwa] Wrote icon-192.png, icon-512.png, favicon.png from branding app icon.');
  } else {
    copyIfExists(path.join(mobileAssets, 'icon.png'), path.join(distDir, 'icon-192.png'));
    copyIfExists(path.join(mobileAssets, 'icon.png'), path.join(distDir, 'icon-512.png'));
    if (copyIfExists(path.join(mobileAssets, 'favicon.png'), path.join(distDir, 'favicon.png'))) {
      havePngFavicon = true;
    }
  }

  const manifest = {
    name: 'Weyou Customer',
    short_name: 'Weyou',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#3d0f3d',
    theme_color: '#7a2d7a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ...(havePngFavicon
        ? [{ src: '/favicon.png', sizes: '192x192', type: 'image/png' }]
        : fs.existsSync(path.join(distDir, 'favicon.ico'))
          ? [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }]
          : []),
    ],
  };

  const manifestPath = path.join(distDir, 'manifest.json');
  writeText(manifestPath, JSON.stringify(manifest, null, 2));

  const swPath = path.join(distDir, 'sw.js');
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
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    }).catch(() => fetch(req))
  );
});
`;
  writeText(swPath, sw);

  const indexPath = path.join(distDir, 'index.html');
  let indexHtml = readText(indexPath);
  if (!indexHtml) {
    console.error(`[postexport-pwa] index.html missing at ${indexPath}`);
    process.exit(1);
  }

  if (havePngFavicon && fs.existsSync(path.join(distDir, 'favicon.png'))) {
    indexHtml = indexHtml.replace(
      /<link rel="icon"[^>]*\/?>/i,
      '<link rel="icon" type="image/png" href="/favicon.png" />'
    );
    if (!indexHtml.includes('apple-touch-icon')) {
      indexHtml = indexHtml.replace(
        '</head>',
        '  <link rel="apple-touch-icon" href="/icon-192.png" />\n</head>'
      );
    }
  }

  const hasManifestLink = indexHtml.includes('rel="manifest"') || indexHtml.includes('manifest.json');
  if (!hasManifestLink) {
    const beforeManifest = indexHtml;
    indexHtml = indexHtml.replace(
      /<link rel="icon"[^>]*\/>\s*/m,
      (m) => `${m}\n  <link rel="manifest" href="/manifest.json" />\n  <meta name="theme-color" content="#7a2d7a" />\n`
    );
    if (indexHtml === beforeManifest) {
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
          console.warn('SW register failed', e);
        });
      });
    }
  </script>
</body>`
    );
  }

  if (!indexHtml.includes('weyou-viewport-fill')) {
    indexHtml = indexHtml.replace(
      /<meta\s+name="viewport"[^>]*\/?>/i,
      '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />'
    );
    indexHtml = indexHtml.replace(
      '</head>',
      `  <style id="weyou-viewport-fill">
      html, body {
        min-height: 100%;
        min-height: 100dvh;
        height: 100%;
        background-color: #3d0f3d;
      }
      #root {
        min-height: 100%;
        min-height: 100dvh;
        display: flex;
        flex: 1;
        background-color: #3d0f3d;
      }
    </style>
</head>`
    );
  }

  writeText(indexPath, indexHtml);

  console.log('[postexport-pwa] PWA files generated in dist/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
