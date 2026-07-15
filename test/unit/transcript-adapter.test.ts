import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractResultV1 } from '../../src/codex/transcript-adapter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('Codex transcript summary', () => {
  it('extracts the latest desktop final answer instead of commentary', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-transcript-'));
    temporaryDirectories.push(directory);
    const filename = path.join(directory, 'rollout.jsonl');
    const lines = [
      {
        type: 'response_item',
        payload: {
          type: 'message', role: 'assistant', phase: 'final_answer',
          content: [{ type: 'output_text', text: '# เสร็จแล้ว\n\n- แก้ hook\n- ทดสอบผ่าน' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message', role: 'assistant', phase: 'commentary',
          content: [{ type: 'output_text', text: 'ข้อความระหว่างทำงานที่ไม่ควรส่ง' }],
        },
      },
    ];
    await fs.writeFile(filename, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);

    await expect(extractResultV1(filename, 700)).resolves.toBe('เสร็จแล้ว\n\n- แก้ hook\n- ทดสอบผ่าน');
  });

  it('redacts secrets and bounds the Watch summary', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-transcript-'));
    temporaryDirectories.push(directory);
    const filename = path.join(directory, 'rollout.jsonl');
    const line = {
      role: 'assistant',
      content: `token=abcdefghijklmnopqrstuvwxyz1234567890\n${'x'.repeat(100)}`,
    };
    await fs.writeFile(filename, `${JSON.stringify(line)}\n`);

    const result = await extractResultV1(filename, 60);
    expect(result).toContain('[REDACTED]');
    expect(result).toHaveLength(60);
    expect(result.endsWith('…')).toBe(true);
  });
});
