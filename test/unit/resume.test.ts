import { describe, expect, it } from 'vitest';
import { buildResumeSpawnSpec } from '../../src/codex/resume.js';

describe('safe Codex resume', () => {
  it('keeps Thai, quotes, newlines, backticks and shell metacharacters in one prompt argument', () => {
    const prompt = 'แก้ "test"\n`whoami` & del * | echo $HOME; $(id)';
    const spec = buildResumeSpawnSpec('codex.exe', 'session_12345678', prompt, 'C:\\repo', 6000);
    expect(spec.options.shell).toBe(false);
    expect(spec.args).toEqual(['exec', 'resume', '--json', 'session_12345678', prompt]);
    expect(spec.args).toHaveLength(5);
  });
});
