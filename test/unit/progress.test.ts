import { describe, expect, it } from 'vitest';
import { parseCodexJsonLine } from '../../src/codex/progress.js';

describe('Codex JSONL progress', () => {
  it('renders observable command, file, message, and completion events', () => {
    expect(parseCodexJsonLine(JSON.stringify({
      type: 'item.started',
      item: { type: 'command_execution', command: 'npm.cmd test' },
    }))).toEqual({ icon: '⚙️', message: 'กำลังรัน: npm.cmd test' });

    expect(parseCodexJsonLine(JSON.stringify({
      type: 'item.completed',
      item: { type: 'file_change', changes: [{ path: 'src/app.ts' }, { path: 'test/app.test.ts' }] },
    }))).toEqual({ icon: '✏️', message: 'แก้ไขไฟล์: src/app.ts, test/app.test.ts' });

    expect(parseCodexJsonLine(JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'แก้ไขและทดสอบเรียบร้อย' },
    }))).toEqual({ icon: '💬', message: 'Codex: แก้ไขและทดสอบเรียบร้อย' });

    expect(parseCodexJsonLine('{"type":"turn.completed"}')).toEqual({
      icon: '✅',
      message: 'Codex ทำงานเสร็จแล้ว',
    });
  });

  it('redacts secrets and never renders reasoning events', () => {
    const command = parseCodexJsonLine(JSON.stringify({
      type: 'item.started',
      item: { type: 'command_execution', command: 'deploy token=super-secret-value' },
    }));
    expect(command?.message).toBe('กำลังรัน: deploy [REDACTED]');
    expect(parseCodexJsonLine(JSON.stringify({
      type: 'item.completed',
      item: { type: 'reasoning', text: 'private reasoning' },
    }))).toBeUndefined();
  });

  it('ignores malformed and unknown events', () => {
    expect(parseCodexJsonLine('not-json')).toBeUndefined();
    expect(parseCodexJsonLine('{"type":"unknown"}')).toBeUndefined();
  });
});
