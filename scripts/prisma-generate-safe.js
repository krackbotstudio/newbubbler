/**
 * Stops all Node processes then runs prisma generate (fixes EPERM on Windows when API holds the engine).
 * Run from repo root: npm run prisma:generate:safe
 *
 * Do not use `shell: true` with paths that contain spaces (e.g. `E:\Krackbot products\Bubbler`):
 * Windows would try to run `E:\Krackbot` as the command.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const root = path.resolve(__dirname, '..');

if (isWin) {
  const cmdPath = path.join(__dirname, 'prisma-generate-safe.cmd');
  try {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', cmdPath], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    });
  } catch (e) {
    process.exit(typeof e.status === 'number' ? e.status : 1);
  }
} else {
  try {
    execFileSync('sh', ['-c', 'pkill node || true; sleep 2; npm run prisma:generate'], {
      cwd: root,
      stdio: 'inherit',
    });
  } catch (e) {
    process.exit(typeof e.status === 'number' ? e.status : 1);
  }
}
