#!/usr/bin/env node
import { readHookConfig } from '../config/schema.js';
import { stopEventSchema } from '../security/validate.js';
import { EventSpool } from './spool.js';

async function readStdin(maxBytes = 64 * 1024): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > maxBytes) throw new Error('Hook input too large');
  }
  return input;
}

async function run(): Promise<void> {
  let config;
  let event;
  try {
    config = readHookConfig();
    event = stopEventSchema.parse(JSON.parse(await readStdin()));
  } catch {
    return;
  }
  try {
    const response = await fetch(`http://127.0.0.1:${config.BRIDGE_PORT}/v1/events/codex/stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-secret': config.BRIDGE_SECRET },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(config.HOOK_TIMEOUT_MS),
    });
    if (response.ok) return;
  } catch {
    // Offline is recoverable; spool below.
  }
  await new EventSpool(config.BRIDGE_RUNTIME_DIR, config.HOOK_SPOOL_MAX).append(event).catch(() => undefined);
}

await run();
process.exitCode = 0;
