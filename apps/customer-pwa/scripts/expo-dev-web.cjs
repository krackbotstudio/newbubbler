'use strict';
/**
 * Start Expo for web without blocking on "port in use" prompts (non-interactive / CI safe).
 * Scans TCP ports starting at EXPO_CUSTOMER_PWA_PORT (default 8095) until one is free.
 */
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const wantsClear = process.argv.includes('--clear');

/** True if something is accepting TCP connections on this port (works with IPv4/IPv6 listeners on Windows). */
function portInUse(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host, allowHalfOpen: true });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', (err) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') resolve(false);
      else resolve(true);
    });
  });
}

async function tcpPortBusy(port) {
  if (await portInUse(port, '127.0.0.1')) return true;
  try {
    if (await portInUse(port, '::1')) return true;
  } catch (_) {
    /* ignore */
  }
  return false;
}

async function pickPort() {
  const start = Number(process.env.EXPO_CUSTOMER_PWA_PORT || 8095);
  if (!Number.isFinite(start) || start < 1024 || start > 65500) {
    throw new Error('EXPO_CUSTOMER_PWA_PORT must be a number between 1024 and 65500');
  }
  for (let p = start; p < start + 50; p++) {
    if (!(await tcpPortBusy(p))) return p;
  }
  throw new Error(`No free TCP port in range ${start}–${start + 49}`);
}

async function main() {
  const port = await pickPort();
  const expoPkg = require.resolve('expo/package.json', { paths: [projectRoot] });
  const expoCli = path.join(path.dirname(expoPkg), 'bin', 'cli');
  const args = ['start', '--web', '--port', String(port)];
  if (wantsClear) args.push('--clear');
  // eslint-disable-next-line no-console
  console.log(
    `[customer-pwa] Expo web → http://localhost:${port} (override base with EXPO_CUSTOMER_PWA_PORT)`,
  );
  const child = spawn(process.execPath, [expoCli, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
