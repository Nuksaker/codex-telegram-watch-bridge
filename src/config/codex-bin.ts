import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseDotEnv } from 'dotenv';
import { runtimeEnvPath } from './paths.js';

interface ResolveCodexBinOptions {
  runtimeDir: string;
  projectEnvPath?: string;
  environment?: NodeJS.ProcessEnv;
}

export async function resolveCodexBinForSetup(options: ResolveCodexBinOptions): Promise<string> {
  const environment = options.environment ?? process.env;
  const runtimeValue = await readEnvValue(runtimeEnvPath(options.runtimeDir), 'CODEX_BIN');
  const projectValue = await readEnvValue(options.projectEnvPath ?? path.resolve('.env'), 'CODEX_BIN');
  const appData = environment.APPDATA;
  const knownNpmExecutable = appData
    ? path.join(
      appData,
      'npm',
      'node_modules',
      '@openai',
      'codex',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    )
    : undefined;

  for (const candidate of [runtimeValue, projectValue, environment.CODEX_BIN, knownNpmExecutable]) {
    if (candidate && candidate !== 'codex' && await fileExists(candidate)) return candidate;
  }
  return runtimeValue ?? projectValue ?? environment.CODEX_BIN ?? 'codex';
}

async function readEnvValue(filename: string, key: string): Promise<string | undefined> {
  try {
    const values = parseDotEnv(await fs.readFile(filename, 'utf8'));
    const value = values[key]?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

async function fileExists(filename: string): Promise<boolean> {
  try {
    await fs.access(filename);
    return true;
  } catch {
    return false;
  }
}
