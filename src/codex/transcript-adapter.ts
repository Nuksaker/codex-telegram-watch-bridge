import fs from 'node:fs/promises';
import { redact } from '../security/redact.js';

interface TranscriptMessage {
  role?: string;
  content?: unknown;
  phase?: string;
  message?: TranscriptMessage;
}

interface TranscriptLine extends TranscriptMessage {
  type?: string;
  payload?: TranscriptMessage;
}

function textFromContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;
  const pieces = content.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (hasText(item)) return [item.text];
    return [];
  });
  return pieces.join('\n') || undefined;
}

function hasText(value: unknown): value is { text: string } {
  return typeof value === 'object' && value !== null && 'text' in value && typeof value.text === 'string';
}

export async function extractResultV1(transcriptPath: string | null | undefined, maxChars: number): Promise<string> {
  if (!transcriptPath) return 'Codex จบการทำงานแล้ว เปิดรายละเอียดบนคอมพิวเตอร์เพื่อตรวจสอบผลลัพธ์';
  try {
    const raw = await fs.readFile(transcriptPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-500).reverse().map(
      (line) => JSON.parse(line) as TranscriptLine,
    );
    const finalAnswer = findAssistantText(lines, (message) => message.phase === 'final_answer');
    if (finalAnswer) return watchSummary(finalAnswer, maxChars);
    const legacyAnswer = findAssistantText(lines, (message) => message.phase === undefined);
    if (legacyAnswer) return watchSummary(legacyAnswer, maxChars);
  } catch {
    // Best-effort unstable adapter. A generic result is safer than failing delivery.
  }
  return 'Codex จบการทำงานแล้ว แต่ไม่สามารถอ่านสรุปจาก transcript รุ่นนี้ได้';
}

function findAssistantText(
  lines: TranscriptLine[],
  accept: (message: TranscriptMessage) => boolean,
): string | undefined {
  for (const parsed of lines) {
    const messages = [parsed.payload, parsed.payload?.message, parsed, parsed.message].filter(
      (message): message is TranscriptMessage => message !== undefined,
    );
    for (const message of messages) {
      if (message.role !== 'assistant' || !accept(message)) continue;
      const text = textFromContent(message.content);
      if (text) return text;
    }
  }
  return undefined;
}

function watchSummary(input: string, maxChars: number): string {
  const text = redact(input)
    .replaceAll('\r\n', '\n')
    .replace(/^```[^\n]*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}
