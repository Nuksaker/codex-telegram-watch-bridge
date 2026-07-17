import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deliverStopEvent } from '../../src/hook/deliver.js';
import { hookConfigSchema } from '../../src/config/schema.js';

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

describe('offline Stop hook', () => {
  it('returns quickly and writes one bounded spool entry', async () => {
    const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-hook-test-'));
    dirs.push(runtime);
    const started = performance.now();
    await deliverStopEvent(hookConfigSchema.parse({
      BRIDGE_RUNTIME_DIR: runtime,
      BRIDGE_SECRET: 's'.repeat(40),
      BRIDGE_PORT: 65534,
      HOOK_TIMEOUT_MS: 300,
      HOOK_SPOOL_MAX: 100,
    }), {
      session_id: 'session_12345678',
      turn_id: 'turn_1234',
      cwd: 'C:\\repo',
      hook_event_name: 'Stop',
    });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(2000);
    const files = await fs.readdir(path.join(runtime, 'spool'));
    expect(files.filter((file) => file.endsWith('.json'))).toHaveLength(1);
  });
});
