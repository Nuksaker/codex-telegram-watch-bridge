import { Bot, InlineKeyboard } from 'grammy';
import type { Logger } from 'pino';
import type { CompletionNotice, IncomingText, SentMessage, TelegramTransport } from '../types.js';
import { completionText } from './messages.js';
import { isAuthorizedIdentity } from './authorization.js';

export class GrammyTelegramTransport implements TelegramTransport {
  private readonly bot: Bot;
  private polling?: Promise<void>;
  private onText?: (message: IncomingText) => Promise<void>;
  private readonly inboundTimes: number[] = [];

  constructor(
    token: string,
    private readonly allowedUserId: number,
    private readonly allowedChatId: number,
    private readonly logger: Logger,
  ) {
    this.bot = new Bot(token);
    this.bot.on('message:text', async (context) => {
      const userId = context.from.id;
      const chatId = context.chat.id;
      if (!isAuthorizedIdentity(
        { userId, chatId },
        { userId: this.allowedUserId, chatId: this.allowedChatId },
      )) {
        this.logger.warn({ userId, chatId }, 'Rejected unauthorized Telegram update');
        return;
      }
      if (!this.acceptRateLimited()) {
        this.logger.warn({ userId, chatId }, 'Telegram command rate limit exceeded');
        await context.reply('ส่งคำสั่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
        return;
      }
      await this.onText?.({
        userId,
        chatId,
        messageId: context.message.message_id,
        text: context.message.text,
        ...(context.message.reply_to_message?.message_id === undefined
          ? {}
          : { replyToMessageId: context.message.reply_to_message.message_id }),
      });
    });
    this.bot.on('message:voice', async (context) => {
      if (context.from.id === this.allowedUserId && context.chat.id === this.allowedChatId) {
        await context.reply('ยังไม่ได้ตั้งค่าถอดเสียง voice note กรุณาใช้ Dictation ให้เป็นข้อความ Telegram แล้วส่งอีกครั้ง');
      }
    });
    this.bot.on('callback_query:data', async (context) => {
      const userId = context.from.id;
      const chatId = context.chat?.id;
      if (chatId === undefined || !isAuthorizedIdentity(
        { userId, chatId },
        { userId: this.allowedUserId, chatId: this.allowedChatId },
      )) return;
      await context.answerCallbackQuery();
      if (context.callbackQuery.data === 'continue') {
        await context.reply('ตอบกลับข้อความแจ้งเตือนเดิมด้วยคำสั่งที่ต้องการได้เลย');
      } else if (context.callbackQuery.data === 'details') {
        await context.reply('รายละเอียดฉบับย่ออยู่ในข้อความแจ้งเตือนแล้ว ใช้ /status เพื่อตรวจสถานะ bridge');
      } else if (context.callbackQuery.data === 'mute') {
        await context.reply('ตอบกลับข้อความแจ้งเตือนเดิมด้วย /mute เพื่อปิดแจ้งเตือน session นี้');
      }
    });
  }

  async sendCompletion(notice: CompletionNotice): Promise<SentMessage> {
    const keyboard = new InlineKeyboard()
      .text('▶️ สั่งต่อ', 'continue')
      .text('📋 รายละเอียด', 'details')
      .row()
      .text('🔕 ปิดแจ้งเตือน', 'mute');
    const message = await this.withRetry(() => this.bot.api.sendMessage(
      this.allowedChatId,
      completionText(notice),
      { reply_markup: keyboard },
    ));
    return { chatId: message.chat.id, messageId: message.message_id };
  }

  async sendText(chatId: number, text: string): Promise<SentMessage> {
    const message = await this.withRetry(() => this.bot.api.sendMessage(chatId, text));
    return { chatId: message.chat.id, messageId: message.message_id };
  }

  async start(onText: (message: IncomingText) => Promise<void>): Promise<void> {
    this.onText = onText;
    await this.bot.init();
    this.polling = this.bot.start({ drop_pending_updates: false });
    this.polling.catch((error: unknown) => this.logger.error({ err: error }, 'Telegram polling stopped'));
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    await this.polling?.catch(() => undefined);
  }

  private acceptRateLimited(now = Date.now()): boolean {
    while (this.inboundTimes[0] !== undefined && now - this.inboundTimes[0] > 60_000) this.inboundTimes.shift();
    if (this.inboundTimes.length >= 12) return false;
    this.inboundTimes.push(now);
    return true;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Telegram request failed');
  }
}
