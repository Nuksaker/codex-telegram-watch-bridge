import type { CodexRunResult, CodexRunner, CompletionNotice, IncomingText, SentMessage, TelegramTransport } from '../../src/types.js';

export class FakeTelegram implements TelegramTransport {
  readonly completions: CompletionNotice[] = [];
  readonly texts: Array<{ chatId: number; text: string }> = [];
  private nextId = 100;
  private handler?: (message: IncomingText) => Promise<void>;

  sendCompletion(notice: CompletionNotice): Promise<SentMessage> {
    this.completions.push(notice);
    return Promise.resolve({ chatId: 22, messageId: this.nextId++ });
  }

  sendText(chatId: number, text: string): Promise<SentMessage> {
    this.texts.push({ chatId, text });
    return Promise.resolve({ chatId, messageId: this.nextId++ });
  }

  start(handler: (message: IncomingText) => Promise<void>): Promise<void> { this.handler = handler; return Promise.resolve(); }
  stop(): Promise<void> { return Promise.resolve(); }
  async receive(message: IncomingText): Promise<void> { await this.handler?.(message); }
}

export class FakeCodex implements CodexRunner {
  readonly calls: Array<{ sessionId: string; prompt: string; cwd: string }> = [];
  result: CodexRunResult = { exitCode: 0, stdout: 'ok', stderr: '' };
  resume(sessionId: string, prompt: string, cwd: string): Promise<CodexRunResult> {
    this.calls.push({ sessionId, prompt, cwd });
    return Promise.resolve(this.result);
  }
}
