import path from 'node:path';
import { z } from 'zod';
import type { CodexStopEvent } from '../types.js';

const sessionId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/);
const turnId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{3,127}$/);

export const stopEventSchema: z.ZodType<CodexStopEvent> = z.object({
  session_id: sessionId,
  turn_id: turnId,
  cwd: z.string().min(1).max(4096),
  hook_event_name: z.literal('Stop'),
  transcript_path: z.string().max(4096).nullable().optional(),
  model: z.string().max(100).optional(),
  permission_mode: z.string().max(50).optional(),
});

export function validateSessionId(value: string): string {
  return sessionId.parse(value);
}

export function validatePrompt(value: string, maxChars: number): string {
  const normalized = value.replaceAll('\0', '').trim();
  if (!normalized || normalized.length > maxChars) {
    throw new Error(`Prompt must contain 1-${maxChars} characters`);
  }
  return normalized;
}

export function projectLabel(cwd: string): string {
  return path.basename(path.resolve(cwd)).slice(0, 80) || 'unknown-project';
}
