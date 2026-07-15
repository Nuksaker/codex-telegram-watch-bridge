import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

describe('offline Stop hook', () => {
  it('exits zero quickly and writes one bounded spool entry', async () => {
    const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-hook-test-'));
    dirs.push(runtime);
    const started = performance.now();
    const result = await runHook(runtime);
    const elapsed = performance.now() - started;
    expect(result.code).toBe(0);
    expect(elapsed).toBeLessThan(2000);
    const files = await fs.readdir(path.join(runtime, 'spool'));
    expect(files.filter((file) => file.endsWith('.json'))).toHaveLength(1);
  });
});

function runHook(runtime: string): Promise<{ code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/hook/stop-hook.ts'], {
      cwd: path.resolve('.'),
      shell: false,
      env: {
        ...process.env,
        BRIDGE_RUNTIME_DIR: runtime,
        BRIDGE_SECRET: 's'.repeat(40),
        BRIDGE_PORT: '65534',
        HOOK_TIMEOUT_MS: '300',
      },
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code }));
    child.stdin.end(JSON.stringify({
      session_id: 'session_12345678', turn_id: 'turn_1234', cwd: 'C:\\repo', hook_event_name: 'Stop',
    }));
  });
}
