import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Bot } from 'grammy';
import { readBridgeConfig } from '../config/schema.js';
import { defaultCodexHome } from '../config/paths.js';
import { HOOK_MARKER, readHookFile } from '../hook/installer.js';
import type { BridgeConfig } from '../config/schema.js';

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
let config: BridgeConfig | undefined;
try {
  config = readBridgeConfig();
  checks.push({ name: 'configuration', ok: true, detail: 'valid and secret values redacted' });
} catch {
  checks.push({ name: 'configuration', ok: false, detail: 'missing or incompatible runtime .env; run npm run setup' });
}

if (config) {
  try {
    await fs.mkdir(config.BRIDGE_RUNTIME_DIR, { recursive: true });
    const probe = path.join(config.BRIDGE_RUNTIME_DIR, '.doctor-write-test');
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    checks.push({ name: 'runtime directory', ok: true, detail: 'writable' });
  } catch {
    checks.push({ name: 'runtime directory', ok: false, detail: 'not writable' });
  }
  try {
    const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
    const me = await bot.api.getMe();
    const updates = await bot.api.getUpdates({ limit: 100, timeout: 0 });
    const identitySeen = updates.some((update) => {
      const message = update.message;
      return message?.from.id === config.TELEGRAM_ALLOWED_USER_ID &&
        message.chat.id === config.TELEGRAM_ALLOWED_CHAT_ID;
    });
    checks.push({ name: 'Telegram token', ok: true, detail: `valid for @${me.username}` });
    checks.push({ name: 'Telegram identity', ok: identitySeen, detail: identitySeen ? 'allowed user/chat observed' : 'configured IDs not found in recent updates' });
  } catch {
    checks.push({ name: 'Telegram token', ok: false, detail: 'invalid or Telegram unreachable' });
  }
  checks.push(await checkExecutable(config.CODEX_BIN));
  try {
    const response = await fetch(`http://127.0.0.1:${config.BRIDGE_PORT}/health/ready`, { signal: AbortSignal.timeout(700) });
    checks.push({ name: 'local bridge', ok: response.ok, detail: response.ok ? 'ready on loopback' : `HTTP ${response.status}` });
  } catch {
    checks.push({ name: 'local bridge', ok: false, detail: 'offline; start with npm run start' });
  }
  checks.push(await checkPort(config.BRIDGE_PORT));
}

const hookDoc = await readHookFile(path.join(defaultCodexHome(), 'hooks.json')).catch(() => ({}));
const hookText = JSON.stringify(hookDoc);
checks.push({ name: 'Codex Stop hook', ok: hookText.includes(HOOK_MARKER), detail: hookText.includes(HOOK_MARKER) ? 'installed; trust state must be reviewed with /hooks' : 'missing' });

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
process.exitCode = checks.every((check) => check.ok || ['local bridge', 'port availability', 'Codex Stop hook', 'Telegram identity'].includes(check.name)) ? 0 : 1;

function checkExecutable(command: string): Promise<Check> {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { shell: false, windowsHide: true });
    child.once('error', () => resolve({ name: 'Codex executable', ok: false, detail: 'not found; set CODEX_BIN' }));
    child.once('close', (code) => resolve({ name: 'Codex executable', ok: code === 0, detail: code === 0 ? 'found' : `exit ${String(code)}` }));
  });
}

function checkPort(port: number): Promise<Check> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve({ name: 'port availability', ok: false, detail: `port ${port} is in use (expected while bridge runs)` }));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve({ name: 'port availability', ok: true, detail: `port ${port} available` })));
  });
}
