import { afterEach, describe, expect, it } from 'vitest';
import { ResumeQueue } from '../../src/codex/queue.js';
import { BridgeDatabase } from '../../src/storage/database.js';
import type { CodexRunResult, CodexRunner } from '../../src/types.js';

let database: BridgeDatabase | undefined;
afterEach(() => database?.close());

describe('resume queue lifecycle', () => {
  it('exposes the job immediately and records running then completed', async () => {
    database = new BridgeDatabase(':memory:');
    const runner: CodexRunner = {
      resume: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const queue = new ResumeQueue(database, runner, 1);

    const submission = queue.enqueue('session_12345678', 'ทำต่อ', 'C:\\app', 100, 'ทำต่อ');
    expect(submission.jobId).toBe(1);
    await submission.started;
    expect(database.recentJobs()[0]).toEqual(expect.objectContaining({ status: 'running' }));
    await expect(submission.completion).resolves.toEqual({ status: 'completed', exitCode: 0 });
    expect(database.recentJobs()[0]).toEqual(expect.objectContaining({ status: 'completed' }));
  });

  it('rejects a second command for the same session while the first is claimed', async () => {
    database = new BridgeDatabase(':memory:');
    let finish: (result: CodexRunResult) => void = () => undefined;
    const runner: CodexRunner = {
      resume: () => new Promise<CodexRunResult>((resolve) => { finish = resolve; }),
    };
    const queue = new ResumeQueue(database, runner, 1);
    const first = queue.enqueue('session_12345678', 'งานแรก', 'C:\\app', 100, 'งานแรก');
    await first.started;

    expect(() => queue.enqueue('session_12345678', 'งานสอง', 'C:\\app', 101, 'งานสอง'))
      .toThrow('SESSION_BUSY');
    finish({ exitCode: 0, stdout: '', stderr: '' });
    await first.completion;
  });
});
