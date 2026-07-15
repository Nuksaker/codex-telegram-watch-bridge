import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { CodexRunResult, CodexRunner } from '../types.js';
import { validatePrompt, validateSessionId } from '../security/validate.js';

export interface SpawnSpec {
  command: string;
  args: string[];
  options: { cwd: string; shell: false; windowsHide: true };
}

export function buildResumeSpawnSpec(codexBin: string, sessionId: string, prompt: string, cwd: string, maxPromptChars: number): SpawnSpec {
  return {
    command: codexBin,
    args: ['exec', 'resume', validateSessionId(sessionId), validatePrompt(prompt, maxPromptChars)],
    options: { cwd, shell: false, windowsHide: true },
  };
}

type SpawnFn = (command: string, args: readonly string[], options: SpawnSpec['options']) => ChildProcess;

export class ProcessCodexRunner implements CodexRunner {
  constructor(
    private readonly codexBin: string,
    private readonly maxPromptChars: number,
    private readonly spawnFn: SpawnFn = spawn,
  ) {}

  resume(sessionId: string, prompt: string, cwd: string): Promise<CodexRunResult> {
    const spec = buildResumeSpawnSpec(this.codexBin, sessionId, prompt, cwd, this.maxPromptChars);
    return new Promise((resolve, reject) => {
      const child = this.spawnFn(spec.command, spec.args, spec.options);
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => { stdout = boundedAppend(stdout, chunk.toString(), 20_000); });
      child.stderr?.on('data', (chunk: Buffer) => { stderr = boundedAppend(stderr, chunk.toString(), 20_000); });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
    });
  }
}

function boundedAppend(current: string, next: string, max: number): string {
  const combined = current + next;
  return combined.length > max ? combined.slice(-max) : combined;
}
