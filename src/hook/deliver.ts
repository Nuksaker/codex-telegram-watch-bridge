import type { HookConfig } from '../config/schema.js';
import type { CodexStopEvent } from '../types.js';
import { EventSpool } from './spool.js';

export async function deliverStopEvent(config: HookConfig, event: CodexStopEvent): Promise<void> {
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
