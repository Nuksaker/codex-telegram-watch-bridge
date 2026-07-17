import type { Logger } from 'pino';
import type { BridgeConfig } from '../config/schema.js';
import type { CodexStopEvent, IncomingText, TelegramTransport } from '../types.js';
import type { BridgeDatabase } from '../storage/database.js';
import type { ResumeQueue } from '../codex/queue.js';
import { extractResultV1 } from '../codex/transcript-adapter.js';
import { isAuthorizedIdentity } from '../telegram/authorization.js';
import { projectLabel } from '../security/validate.js';
import { safeExcerpt, shortId } from '../security/redact.js';
import type { ResumeJobSummary } from '../storage/database.js';

export class BridgeService {
  private readonly requireExplicitSelection = new Set<number>();

  constructor(
    private readonly config: BridgeConfig,
    private readonly database: BridgeDatabase,
    private readonly telegram: TelegramTransport,
    private readonly queue: ResumeQueue,
    private readonly logger: Logger,
  ) {}

  async handleStop(event: CodexStopEvent): Promise<{ duplicate: boolean; muted: boolean }> {
    const project = projectLabel(event.cwd);
    const inserted = this.database.recordStopEvent({
      sessionId: event.session_id,
      turnId: event.turn_id,
      project,
      cwd: event.cwd,
    });
    if (!inserted) return { duplicate: true, muted: false };
    const session = this.database.getSession(event.session_id);
    if (session?.muted) return { duplicate: false, muted: true };
    const excerpt = await extractResultV1(event.transcript_path, this.config.MAX_EXCERPT_CHARS);
    const sent = await this.telegram.sendCompletion({
      project,
      sessionId: event.session_id,
      turnId: event.turn_id,
      status: 'completed',
      excerpt,
    });
    this.database.mapMessage(sent.chatId, sent.messageId, event.session_id, event.turn_id);
    this.logger.info({
      sessionId: shortId(event.session_id),
      turnId: shortId(event.turn_id),
      project,
    }, 'Completion notification delivered');
    return { duplicate: false, muted: false };
  }

  async handleTelegramText(message: IncomingText): Promise<void> {
    if (!isAuthorizedIdentity(
      { userId: message.userId, chatId: message.chatId },
      { userId: this.config.TELEGRAM_ALLOWED_USER_ID, chatId: this.config.TELEGRAM_ALLOWED_CHAT_ID },
    )) {
      this.logger.warn({ userId: message.userId, chatId: message.chatId }, 'Rejected unauthorized Telegram command');
      return;
    }
    if (await this.handleCommand(message)) return;
    let sessionId = message.replyToMessageId === undefined
      ? undefined
      : this.database.sessionForMessage(message.chatId, message.replyToMessageId);
    if (sessionId) this.requireExplicitSelection.delete(message.chatId);
    sessionId ??= this.database.activeTarget(message.chatId);
    if (!sessionId) {
      const recent = this.database.recentSessions();
      if (recent.length === 1 && !this.requireExplicitSelection.has(message.chatId)) {
        sessionId = recent[0]?.sessionId;
      } else if (recent.length > 0) {
        await this.telegram.sendText(message.chatId, selectionText(recent));
        return;
      }
    }
    if (!sessionId) {
      await this.telegram.sendText(message.chatId, 'ยังไม่มี Codex session ที่เลือก กรุณารอข้อความแจ้งเตือนหรือใช้ /sessions');
      return;
    }
    const session = this.database.getSession(sessionId);
    if (!session) {
      await this.telegram.sendText(message.chatId, 'ไม่พบ session ที่บันทึกไว้ จะไม่สร้าง session ใหม่ให้อัตโนมัติ');
      return;
    }
    try {
      const promptPreview = safeExcerpt(message.text, 240);
      const submission = this.queue.enqueue(sessionId, message.text, session.cwd, message.messageId, promptPreview);
      await submission.started;
      const result = await submission.completion;
      if (result.error !== undefined) {
        this.logger.warn({ err: result.error, jobId: submission.jobId }, 'Codex resume process failed');
      }
      if (result.status === 'failed') {
        await this.telegram.sendText(
          message.chatId,
          `❌ งาน #${submission.jobId} ล้มเหลว${result.exitCode === null ? '' : ` (exit ${result.exitCode})`}\nใช้ /jobs เพื่อตรวจประวัติ แล้วรัน npm.cmd run doctor ที่เครื่อง Windows`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error && error.message === 'SESSION_BUSY'
        ? 'session นี้กำลังทำงานอยู่ กรุณารอให้จบก่อน'
        : 'เริ่ม Codex ไม่สำเร็จ กรุณารัน npm run doctor ที่เครื่อง Windows';
      this.logger.warn({ err: error, sessionId: shortId(sessionId) }, 'Unable to resume Codex session');
      await this.telegram.sendText(message.chatId, `❌ ${reason}`);
    }
  }

  private async handleCommand(message: IncomingText): Promise<boolean> {
    const command = message.text.trim().split(/\s+/, 1)[0]?.toLowerCase();
    if (!command?.startsWith('/')) return false;
    if (command === '/start' || command === '/help') {
      await this.telegram.sendText(message.chatId, 'Bridge พร้อมรับคำสั่ง\n/ping /status /sessions /use /clear /clearall /jobs\nเลือกด้วย /use <ลำดับ> แล้วส่งคำสั่งได้จาก Apple Watch');
      return true;
    }
    if (command === '/ping') {
      await this.telegram.sendText(message.chatId, '🏓 Codex Telegram Bridge ออนไลน์');
      return true;
    }
    if (command === '/status') {
      await this.telegram.sendText(message.chatId, `Bridge: ready\nSessions: ${this.database.recentSessions(20).length}`);
      return true;
    }
    if (command === '/sessions') {
      const recent = this.database.recentSessions();
      await this.telegram.sendText(message.chatId, recent.length ? selectionText(recent) : 'ยังไม่มี session ล่าสุด');
      return true;
    }
    if (command === '/jobs' || command === '/history') {
      const jobs = this.database.recentJobs(5);
      await this.telegram.sendText(message.chatId, jobs.length ? jobsText(jobs) : 'ยังไม่มีประวัติงานจาก Telegram');
      return true;
    }
    if (command === '/use') {
      const selection = Number(message.text.trim().split(/\s+/)[1]);
      const sessions = this.database.recentSessions();
      const chosen = Number.isInteger(selection) && selection > 0 ? sessions[selection - 1] : undefined;
      if (!chosen) await this.telegram.sendText(message.chatId, `กรุณาใช้ /use <number> จากรายการนี้\n${selectionText(sessions)}`);
      else {
        this.database.setActiveTarget(message.chatId, chosen.sessionId);
        this.requireExplicitSelection.delete(message.chatId);
        await this.telegram.sendText(message.chatId, `เลือก ${chosen.project} (${shortId(chosen.sessionId)}) สำหรับข้อความต่อจากนี้แล้ว`);
      }
      return true;
    }
    if (command === '/clear') {
      const cleared = this.database.clearActiveTarget(message.chatId);
      this.requireExplicitSelection.add(message.chatId);
      const prefix = cleared ? 'ล้าง session ที่เลือกค้างไว้แล้ว' : 'ตอนนี้ไม่มี session ที่เลือกค้างไว้';
      await this.telegram.sendText(
        message.chatId,
        `${prefix}\nส่ง /sessions แล้วใช้ /use <ลำดับ> ก่อนส่งคำสั่งถัดไป`,
      );
      return true;
    }
    if (command === '/clearall' || command === '/clear-all') {
      const result = this.database.clearSessionRegistry();
      if (result.blockedJobs > 0) {
        await this.telegram.sendText(
          message.chatId,
          `ยังล้างไม่ได้ มีงานกำลังรันหรือรอคิว ${result.blockedJobs} งาน\nรอให้จบก่อนแล้วส่ง /clearall ใหม่`,
        );
      } else {
        this.requireExplicitSelection.delete(message.chatId);
        await this.telegram.sendText(
          message.chatId,
          `🧹 ล้าง session ใน Bridge แล้ว ${result.clearedSessions} รายการ\nตอนนี้ยังสั่งงานต่อไม่ได้จนกว่าจะมีข้อความ completion ใหม่จาก Codex\nCodex task และ transcript จริงไม่ได้ถูกลบ`,
        );
      }
      return true;
    }
    if (command === '/mute') {
      const target = message.replyToMessageId === undefined
        ? undefined
        : this.database.sessionForMessage(message.chatId, message.replyToMessageId);
      if (!target) await this.telegram.sendText(message.chatId, 'กรุณาตอบกลับข้อความแจ้งเตือนด้วย /mute');
      else {
        this.database.setMuted(target, true);
        await this.telegram.sendText(message.chatId, `ปิดแจ้งเตือน ${shortId(target)} แล้ว`);
      }
      return true;
    }
    if (command === '/unmute') {
      const selection = Number(message.text.trim().split(/\s+/)[1]);
      const muted = this.database.mutedProjects();
      const chosen = Number.isInteger(selection) && selection > 0 ? muted[selection - 1] : undefined;
      if (!chosen) {
        const list = muted.length ? selectionText(muted) : 'ไม่มีโปรเจกต์ที่ปิดแจ้งเตือนอยู่';
        await this.telegram.sendText(message.chatId, `ใช้ /unmute <number>\n${list}`);
      } else {
        this.database.setMuted(chosen.sessionId, false);
        await this.telegram.sendText(message.chatId, `เปิดแจ้งเตือน ${chosen.project} แล้ว`);
      }
      return true;
    }
    await this.telegram.sendText(message.chatId, 'ไม่รู้จักคำสั่งนี้ ใช้ /help เพื่อดูคำสั่งที่รองรับ');
    return true;
  }
}

function jobsText(jobs: ResumeJobSummary[]): string {
  return ['งานล่าสุด:', ...jobs.map((job) => {
    const status = jobStatusText(job.status);
    const exit = job.status === 'failed' && job.exitCode !== null ? ` (exit ${job.exitCode})` : '';
    return `#${job.jobId} ${status}${exit}\n${job.project} (${shortId(job.sessionId)})\n${job.promptPreview || 'ไม่มีข้อความตัวอย่าง'}`;
  })].join('\n\n');
}

function jobStatusText(status: ResumeJobSummary['status']): string {
  if (status === 'queued') return '⏳ รอคิว';
  if (status === 'running') return '▶️ กำลังทำ';
  if (status === 'completed') return '✅ สำเร็จ';
  if (status === 'interrupted') return '⚠️ ถูกหยุดตอน Bridge รีสตาร์ต';
  return '❌ ล้มเหลว';
}

function selectionText(sessions: Array<{ sessionId: string; project: string }>): string {
  return ['มีหลาย session เลือกงานที่จะสั่งต่อ:', ...sessions.map(
    (session, index) => `${index + 1}. ${session.project} (${shortId(session.sessionId)})`,
  ), '', 'ส่ง /use <ลำดับ> เช่น /use 1 แล้วส่งคำสั่งตามปกติ'].join('\n');
}
