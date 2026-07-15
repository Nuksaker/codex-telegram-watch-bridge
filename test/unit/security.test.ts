import { describe, expect, it } from 'vitest';
import { isAuthorizedIdentity } from '../../src/telegram/authorization.js';
import { safeExcerpt } from '../../src/security/redact.js';
import { stopEventSchema, validatePrompt } from '../../src/security/validate.js';

describe('security validation', () => {
  it('requires both Telegram user and chat identity', () => {
    expect(isAuthorizedIdentity({ userId: 1, chatId: 2 }, { userId: 1, chatId: 2 })).toBe(true);
    expect(isAuthorizedIdentity({ userId: 1, chatId: 99 }, { userId: 1, chatId: 2 })).toBe(false);
    expect(isAuthorizedIdentity({ userId: 99, chatId: 2 }, { userId: 1, chatId: 2 })).toBe(false);
  });

  it('validates only safe Stop routing fields', () => {
    expect(stopEventSchema.parse({
      session_id: 'session_12345678', turn_id: 'turn_1234', cwd: 'C:\\work\\app', hook_event_name: 'Stop', extra: 'ignored',
    })).not.toHaveProperty('extra');
  });

  it('caps prompts and strips null bytes', () => {
    expect(validatePrompt('สวัสดี\0 world', 50)).toBe('สวัสดี world');
    expect(() => validatePrompt('x'.repeat(51), 50)).toThrow();
  });

  it('redacts tokens and secrets from excerpts', () => {
    expect(safeExcerpt('token=abcdef password=hunter2', 100)).toBe('[REDACTED] [REDACTED]');
  });
});
