import path from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';
import { defaultRuntimeDir, runtimeEnvPath } from './paths.js';

const numericId = z.coerce.number().int();

export const bridgeConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_ALLOWED_USER_ID: numericId,
  TELEGRAM_ALLOWED_CHAT_ID: numericId,
  BRIDGE_SECRET: z.string().min(32),
  BRIDGE_HOST: z.literal('127.0.0.1').default('127.0.0.1'),
  BRIDGE_PORT: z.coerce.number().int().min(1024).max(65535).default(47831),
  BRIDGE_RUNTIME_DIR: z.string().min(1).default(defaultRuntimeDir()),
  CODEX_BIN: z.string().min(1).default('codex'),
  MAX_PROMPT_CHARS: z.coerce.number().int().min(1).max(20000).default(6000),
  MAX_EXCERPT_CHARS: z.coerce.number().int().min(100).max(3000).default(700),
  GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;

export const hookConfigSchema = z.object({
  BRIDGE_SECRET: z.string().min(32),
  BRIDGE_PORT: z.coerce.number().int().min(1024).max(65535).default(47831),
  BRIDGE_RUNTIME_DIR: z.string().min(1).default(defaultRuntimeDir()),
  HOOK_TIMEOUT_MS: z.coerce.number().int().min(100).max(1900).default(1500),
  HOOK_SPOOL_MAX: z.coerce.number().int().min(1).max(1000).default(100),
});

export type HookConfig = z.infer<typeof hookConfigSchema>;

export function loadRuntimeEnv(runtimeDir = defaultRuntimeDir()): void {
  loadDotEnv({ path: runtimeEnvPath(runtimeDir), quiet: true });
  loadDotEnv({ path: path.resolve('.env'), quiet: true });
}

export function readBridgeConfig(): BridgeConfig {
  loadRuntimeEnv(process.env.BRIDGE_RUNTIME_DIR ?? defaultRuntimeDir());
  return bridgeConfigSchema.parse(process.env);
}

export function readHookConfig(): HookConfig {
  loadRuntimeEnv(process.env.BRIDGE_RUNTIME_DIR ?? defaultRuntimeDir());
  return hookConfigSchema.parse(process.env);
}
