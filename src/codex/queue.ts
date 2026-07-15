import { createHash } from 'node:crypto';
import type { CodexRunner } from '../types.js';
import type { BridgeDatabase } from '../storage/database.js';

export interface ResumeSubmission {
  jobId: number;
  started: Promise<void>;
  completion: Promise<{ status: 'completed' | 'failed'; exitCode: number | null; error?: unknown }>;
}

export class ResumeQueue {
  private runningGlobal = 0;
  private readonly claimedSessions = new Set<string>();
  private readonly pending: Array<() => void> = [];

  constructor(
    private readonly database: BridgeDatabase,
    private readonly runner: CodexRunner,
    private readonly globalLimit: number,
  ) {}

  enqueue(
    sessionId: string,
    prompt: string,
    cwd: string,
    telegramMessageId: number,
    promptPreview: string,
  ): ResumeSubmission {
    if (this.claimedSessions.has(sessionId)) throw new Error('SESSION_BUSY');
    this.claimedSessions.add(sessionId);
    let jobId: number;
    try {
      const hash = createHash('sha256').update(prompt).digest('hex');
      jobId = this.database.createJob(sessionId, telegramMessageId, hash, promptPreview);
    } catch (error) {
      this.claimedSessions.delete(sessionId);
      throw error;
    }
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const completion = this.run(jobId, sessionId, prompt, cwd, markStarted);
    return { jobId, started, completion };
  }

  private async run(
    jobId: number,
    sessionId: string,
    prompt: string,
    cwd: string,
    markStarted: () => void,
  ): Promise<{ status: 'completed' | 'failed'; exitCode: number | null; error?: unknown }> {
    await this.acquire();
    this.database.updateJob(jobId, 'running');
    markStarted();
    try {
      const result = await this.runner.resume(sessionId, prompt, cwd);
      const status = result.exitCode === 0 ? 'completed' : 'failed';
      this.database.updateJob(jobId, status, result.exitCode);
      return { status, exitCode: result.exitCode };
    } catch (error) {
      this.database.updateJob(jobId, 'failed', null);
      return { status: 'failed', exitCode: null, error };
    } finally {
      this.release(sessionId);
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      const tryStart = (): void => {
        if (this.runningGlobal >= this.globalLimit) {
          this.pending.push(tryStart);
          return;
        }
        this.runningGlobal += 1;
        resolve();
      };
      tryStart();
    });
  }

  private release(sessionId: string): void {
    this.claimedSessions.delete(sessionId);
    this.runningGlobal -= 1;
    this.pending.shift()?.();
  }
}
