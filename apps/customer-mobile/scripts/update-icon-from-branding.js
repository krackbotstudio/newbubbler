/**
 * Downloads the branding logo from the API and saves it as the app icon.
 * Run from repo root: node apps/customer-mobile/scripts/update-icon-from-branding.js
 * Requires: EXPO_PUBLIC_API_URL in .env (with or without /api), e.g.
 * https://weyouapi.krackbot.com/api or http://192.168.x.x:3009
 * Ensure a logo is uploaded in admin branding first.
 *
 * When branding fetch or logo download fails (e.g. API down or cold start), the script
 * exits 0 so the build continues using existing assets. Set SKIP_ICON_UPDATE=1 to skip the update entirely.
 */

const fs = require('fs');
const path = require('path');

const SKIP_ENV = 'SKIP_ICON_UPDATE';

function readEnvVar(envPath, key) {
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(new RegExp(key + '=(.+)'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '').split('#')[0].trim();
}

function normalizeApiRoot(raw) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '');
  return trimmed.replace(/\/api\/?$/, '');
}

/** Fatal: missing config, script cannot run. */
function fatal(message) {
  console.error(message);
  process.exit(1);
}

/** Non-fatal: API/download failed; build should continue with existing assets. */
function softFail(message) {
  console.error(message);
  console.warn('(Build will continue using existing icon assets.)');
  process.exit(0);
}

async function main() {
  if (process.env[SKIP_ENV] === '1' || process.env[SKIP_ENV] === 'true') {
    console.log('Skipping icon update (SKIP_ICON_UPDATE is set).');
    process.exit(0);
  }

  const appDir = path.resolve(__dirname, '..');
  const rootDir = path.resolve(__dirname, '../../..');
  const appEnv = path.join(appDir, '.env');
  const rootEnv = path.join(rootDir, '.env');
  // Logo URL: 1) CLI arg, 2) apps/customer-mobile/.env, 3) process.env, 4) root .env
  const cliUrl = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2].trim() : '';
  const directLogoUrl = cliUrl || readEnvVar(appEnv, 'UPDATE_ICON_LOGO_URL') || process.env.UPDATE_ICON_LOGO_URL || readEnvVar(rootEnv, 'UPDATE_ICON_LOGO_URL');
  let API_BASE = readEnvVar(appEnv, 'EXPO_PUBLIC_API_URL') || readEnvVar(rootEnv, 'EXPO_PUBLIC_API_URL') || process.env.EXPO_PUBLIC_API_URL || '';
  if (!directLogoUrl && !API_BASE) {
    fatal('Set EXPO_PUBLIC_API_URL or UPDATE_ICON_LOGO_URL in apps/customer-mobile/.env\nOr pass the logo URL: npm run update-icon-from-branding -- <API_BASE>/api/assets/branding/logo.png');
  }
  const base = normalizeApiRoot(API_BASE);
  let fullUrl;
  if (directLogoUrl && directLogoUrl.trim()) {
    fullUrl = directLogoUrl.trim();
    console.log('Using logo URL:', fullUrl);
  } else {
    const brandingUrl = `${base}/api/branding/public`;
    console.log('Fetching branding from', brandingUrl);
    let res;
    try {
      res = await fetch(brandingUrl);
    } catch (e) {
      softFail(`Could not reach branding API: ${e.message}`);
    }
    if (!res.ok) {
      if (res.status === 404) {
        softFail('GET /api/branding/public returned 404. Use a direct logo URL or upload a logo in admin branding.');
      } else {
        softFail(`Branding API returned ${res.status}. Is the API running?`);
      }
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      softFail(`Invalid JSON from branding API: ${e.message}`);
    }
    const iconUrl = data && (data.appIconUrl || data.logoUrl);
    if (!iconUrl || !String(iconUrl).trim()) {
      softFail('No appIconUrl/logoUrl in branding. Upload an app icon in admin or set UPDATE_ICON_LOGO_URL.');
    }
    fullUrl = iconUrl.startsWith('http') ? iconUrl : `${base}${iconUrl.startsWith('/') ? '' : '/'}${iconUrl}`;
  }
  let imgRes;
  try {
    imgRes = await fetch(fullUrl);
  } catch (e) {
    softFail(`Failed to download logo: ${e.message}`);
  }
  if (!imgRes.ok) {
    softFail(`Failed to download logo: ${imgRes.status} ${fullUrl}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  const iconPath = path.join(assetsDir, 'icon.png');
  const adaptivePath = path.join(assetsDir, 'adaptive-icon.png');
  const splashPath = path.join(assetsDir, 'splash-icon.png');
  const faviconPath = path.join(assetsDir, 'favicon.png');
  fs.writeFileSync(iconPath, buf);
  fs.writeFileSync(adaptivePath, buf);
  fs.writeFileSync(splashPath, buf);
  fs.writeFileSync(faviconPath, buf);
  console.log('Updated icon, adaptive-icon, splash-icon, and favicon from branding (appIconUrl, else logoUrl).');
  console.log('APK/IPA and app launcher icon will use this logo. Rebuild the app (or run a new EAS build) to see it.');
}

main().catch((e) => {
  console.error(e);
  console.warn('(Build will continue using existing icon assets.)');
  process.exit(0);
});
