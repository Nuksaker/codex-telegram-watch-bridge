import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defaultCodexHome } from '../config/paths.js';
import {
  HOOK_MARKER,
  installHookDocument,
  isBridgeHandler,
  readHookFile,
  uninstallHookDocument,
  writeHookFile,
} from '../hook/installer.js';

const action = process.argv[2] ?? 'status';
const dryRun = process.argv.includes('--dry-run');
const yes = process.argv.includes('--yes');
const target = path.join(defaultCodexHome(), 'hooks.json');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const adapter = path.join(projectRoot, 'dist', 'hook', 'stop-hook.js');
// Codex executes Windows command hooks through the platform command runner.
// Starting a command string with a quoted executable path can be parsed as a
// literal filename, so use node.exe from PATH on Windows.
const command = process.platform === 'win32'
  ? `node.exe "${adapter}"`
  : `"${process.execPath}" "${adapter}"`;
const current = await readHookFile(target);

if (action === 'status') {
  const hooks = (current as { hooks?: { Stop?: Array<{ hooks?: Array<{ statusMessage?: string }> }> } }).hooks?.Stop ?? [];
  const installed = hooks.some((group) => group.hooks?.some(isBridgeHandler) === true);
  console.log(installed ? `installed: ${HOOK_MARKER}` : 'not installed');
  console.log(`target: ${target}`);
  process.exitCode = installed ? 0 : 1;
} else {
  const result = action === 'install'
    ? installHookDocument(current, command)
    : uninstallHookDocument(current);
  console.log(`${action} target: ${target}`);
  console.log(`command: ${command}`);
  console.log(`changed: ${String(result.changed)}`);
  if (!result.changed || dryRun) process.exit(0);
  if (!yes) {
    const prompt = createInterface({ input: stdin, output: stdout });
    const answer = await prompt.question('Apply this change? [y/N] ');
    prompt.close();
    if (answer.trim().toLowerCase() !== 'y') process.exit(0);
  }
  const backup = await writeHookFile(target, result.document);
  console.log('Hook file updated. Review and trust this exact hook with /hooks in Codex.');
  if (backup) console.log(`backup: ${backup}`);
}
