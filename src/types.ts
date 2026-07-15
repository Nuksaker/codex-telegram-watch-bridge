export interface CodexStopEvent {
  session_id: string;
  turn_id: string;
  cwd: string;
  hook_event_name: 'Stop';
  transcript_path?: string | null | undefined;
  model?: string | undefined;
  permission_mode?: string | undefined;
}

export interface CompletionNotice {
  project: string;
  sessionId: string;
  turnId: string;
  status: 'completed' | 'failed' | 'blocked';
  excerpt: string;
  elapsedMs?: number;
}

export interface SentMessage {
  chatId: number;
  messageId: number;
}

export interface IncomingText {
  userId: number;
  chatId: number;
  messageId: number;
  text: string;
  replyToMessageId?: number;
}

export interface TelegramTransport {
  sendCompletion(notice: CompletionNotice): Promise<SentMessage>;
  sendText(chatId: number, text: string): Promise<SentMessage>;
  start(onText: (message: IncomingText) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}

export interface CodexRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface CodexRunner {
  resume(sessionId: string, prompt: string, cwd: string): Promise<CodexRunResult>;
}
