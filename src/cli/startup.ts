import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const STARTUP_TASK = 'CodexTelegramWatchBridge';

export function startupArgs(action: string, nodePath: string, entryPath: string): string[] {
  if (action === 'install') {
    return ['/Create', '/TN', STARTUP_TASK, '/SC', 'ONLOGON', '/TR', `"${nodePath}" "${entryPath}"`, '/F'];
  }
  if (action === 'uninstall') return ['/Delete', '/TN', STARTUP_TASK, '/F'];
  return ['/Query', '/TN', STARTUP_TASK];
}

const action = process.argv[2] ?? 'status';
const dryRun = process.argv.includes('--dry-run');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const entry = path.join(projectRoot, 'dist', 'index.js');
const args = startupArgs(action, process.execPath, entry);
console.log(`schtasks.exe ${args.join(' ')}`);
if (dryRun) process.exit(0);
if (process.platform !== 'win32') {
  console.log('Scheduled Task installation is Windows-only. The generated command above is the preview.');
  process.exit(action === 'status' ? 1 : 0);
}
const result = await promisify(execFile)('schtasks.exe', args, { windowsHide: true });
if (result.stdout) console.log(result.stdout.trim());
if (result.stderr) console.error(result.stderr.trim());
