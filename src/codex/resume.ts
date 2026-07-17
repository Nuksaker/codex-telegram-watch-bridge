import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { CodexRunResult, CodexRunner } from '../types.js';
import { validatePrompt, validateSessionId } from '../security/validate.js';
import { safeExcerpt } from '../security/redact.js';
import { parseCodexJsonLine } from './progress.js';
import type { CodexProgressUpdate } from './progress.js';

export interface SpawnSpec {
  command: string;
  args: string[];
  options: { cwd: string; shell: false; windowsHide: true };
}

export function buildResumeSpawnSpec(codexBin: string, sessionId: string, prompt: string, cwd: string, maxPromptChars: number): SpawnSpec {
  return {
    command: codexBin,
    args: ['exec', 'resume', '--json', validateSessionId(sessionId), validatePrompt(prompt, maxPromptChars)],
    options: { cwd, shell: false, windowsHide: true },
  };
}

type SpawnFn = (command: string, args: readonly string[], options: SpawnSpec['options']) => ChildProcess;

export class ProcessCodexRunner implements CodexRunner {
  constructor(
    private readonly codexBin: string,
    private readonly maxPromptChars: number,
    private readonly onProgress?: (sessionId: string, update: CodexProgressUpdate) => void,
    private readonly spawnFn: SpawnFn = spawn,
  ) {}

  resume(sessionId: string, prompt: string, cwd: string): Promise<CodexRunResult> {
    const spec = buildResumeSpawnSpec(this.codexBin, sessionId, prompt, cwd, this.maxPromptChars);
    this.onProgress?.(sessionId, {
      icon: '📥',
      message: `รับคำสั่งจาก Telegram: ${safeExcerpt(prompt, 240)}`,
    });
    return new Promise((resolve, reject) => {
      const child = this.spawnFn(spec.command, spec.args, spec.options);
      let stdout = '';
      let stderr = '';
      let pendingLine = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout = boundedAppend(stdout, text, 20_000);
        pendingLine += text;
        const lines = pendingLine.split(/\r?\n/);
        pendingLine = lines.pop() ?? '';
        for (const line of lines) this.emitProgress(sessionId, line);
      });
      child.stderr?.on('data', (chunk: Buffer) => { stderr = boundedAppend(stderr, chunk.toString(), 20_000); });
      child.once('error', reject);
      child.once('close', (exitCode) => {
        if (pendingLine.trim()) this.emitProgress(sessionId, pendingLine);
        resolve({ exitCode, stdout, stderr });
      });
    });
  }

  private emitProgress(sessionId: string, line: string): void {
    const update = parseCodexJsonLine(line);
    if (update) this.onProgress?.(sessionId, update);
  }
}

function boundedAppend(current: string, next: string, max: number): string {
  const combined = current + next;
  return combined.length > max ? combined.slice(-max) : combined;
}
