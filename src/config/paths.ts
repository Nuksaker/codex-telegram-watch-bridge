import path from 'node:path';
import os from 'node:os';

export function defaultRuntimeDir(): string {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData
    ? path.join(localAppData, 'CodexTelegramBridge')
    : path.join(os.homedir(), '.local', 'share', 'codex-telegram-bridge');
}

export function defaultCodexHome(): string {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
}

export function runtimeEnvPath(runtimeDir = defaultRuntimeDir()): string {
  return path.join(runtimeDir, '.env');
}
