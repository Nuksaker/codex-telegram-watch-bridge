import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { bridgeConfigSchema } from '../../src/config/schema.js';
import { ResumeQueue } from '../../src/codex/queue.js';
import { BridgeService } from '../../src/server/bridge-service.js';
import { BridgeDatabase } from '../../src/storage/database.js';
import { FakeCodex, FakeTelegram } from '../helpers/fakes.js';

let database: BridgeDatabase | undefined;
afterEach(() => database?.close());

function fixture() {
  const config = bridgeConfigSchema.parse({
    TELEGRAM_BOT_TOKEN: '123456789:abcdefghijklmnopqrstuvwxyzABCDEFG',
    TELEGRAM_ALLOWED_USER_ID: 11,
    TELEGRAM_ALLOWED_CHAT_ID: 22,
    BRIDGE_SECRET: 's'.repeat(40),
    BRIDGE_RUNTIME_DIR: '/tmp/bridge-test',
  });
  database = new BridgeDatabase(':memory:');
  const telegram = new FakeTelegram();
  const codex = new FakeCodex();
  const queue = new ResumeQueue(database, codex, 1);
  const service = new BridgeService(config, database, telegram, queue, pino({ level: 'silent' }));
  return { service, telegram, codex };
}

describe('bridge integration', () => {
  it('sends one notification for a duplicate event', async () => {
    const { service, telegram } = fixture();
    const event = { session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' as const };
    await service.handleStop(event);
    await service.handleStop(event);
    expect(telegram.completions).toHaveLength(1);
  });

  it('reply to completion A resumes A even after B completes', async () => {
    const { service, codex, telegram } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    await service.handleStop({ session_id: 'session_B1234567', turn_id: 'turn_B123', cwd: 'C:\\work\\beta', hook_event_name: 'Stop' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 500, replyToMessageId: 100, text: 'ทำต่อใน A นะ `x` & echo hi' });
    expect(codex.calls).toEqual([{ sessionId: 'session_A1234567', prompt: 'ทำต่อใน A นะ `x` & echo hi', cwd: 'C:\\work\\alpha' }]);
    expect(telegram.texts).toHaveLength(0);
  });

  it('shows redacted command previews and lifecycle in /jobs', async () => {
    const { service, telegram } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    await service.handleTelegramText({
      userId: 11,
      chatId: 22,
      messageId: 500,
      replyToMessageId: 100,
      text: 'แก้ login token=super-secret-value',
    });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 501, text: '/jobs' });

    const history = telegram.texts.at(-1)?.text ?? '';
    expect(history).toContain('#1 ✅ สำเร็จ');
    expect(history).toContain('แก้ login [REDACTED]');
    expect(history).not.toContain('super-secret-value');
  });

  it('keeps Telegram quiet during successful work but reports a failed CLI run', async () => {
    const { service, telegram, codex } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    codex.result = { exitCode: 1, stdout: '', stderr: 'failed' };

    await service.handleTelegramText({
      userId: 11,
      chatId: 22,
      messageId: 500,
      replyToMessageId: 100,
      text: 'ทดสอบงานที่ล้มเหลว',
    });

    expect(telegram.texts).toHaveLength(1);
    expect(telegram.texts[0]?.chatId).toBe(22);
    expect(telegram.texts[0]?.text).toContain('❌ งาน #1 ล้มเหลว (exit 1)');
  });

  it('unauthorized users cannot trigger Codex or view sessions', async () => {
    const { service, codex, telegram } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    await service.handleTelegramText({ userId: 999, chatId: 22, messageId: 500, replyToMessageId: 100, text: '/sessions' });
    expect(codex.calls).toHaveLength(0);
    expect(telegram.texts).toHaveLength(0);
  });

  it('/clear forgets the active target and requires /use before another command', async () => {
    const { service, codex, telegram } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 501, text: '/use 1' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 502, text: '/clear' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 503, text: 'อย่าส่งงานนี้ทันที' });

    expect(codex.calls).toHaveLength(0);
    expect(telegram.texts.at(-1)?.text).toContain('ส่ง /use <ลำดับ>');
  });

  it('/clearall removes all routing until a new completion creates a session', async () => {
    const { service, codex, telegram } = fixture();
    await service.handleStop({ session_id: 'session_A1234567', turn_id: 'turn_A123', cwd: 'C:\\work\\alpha', hook_event_name: 'Stop' });
    await service.handleStop({ session_id: 'session_B1234567', turn_id: 'turn_B123', cwd: 'C:\\work\\beta', hook_event_name: 'Stop' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 501, text: '/use 1' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 502, text: '/clearall' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 503, text: 'ยังไม่ควรทำงาน' });

    expect(codex.calls).toHaveLength(0);
    expect(telegram.texts.at(-1)?.text).toContain('ยังไม่มี Codex session');

    await service.handleStop({ session_id: 'session_C1234567', turn_id: 'turn_C123', cwd: 'C:\\work\\gamma', hook_event_name: 'Stop' });
    await service.handleTelegramText({ userId: 11, chatId: 22, messageId: 504, text: 'ทำงานใน session ใหม่' });
    expect(codex.calls).toEqual([{
      sessionId: 'session_C1234567',
      prompt: 'ทำงานใน session ใหม่',
      cwd: 'C:\\work\\gamma',
    }]);
  });
});
