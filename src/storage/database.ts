import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type ResumeJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';

export interface ResumeJobSummary {
  jobId: number;
  sessionId: string;
  project: string;
  promptPreview: string;
  status: ResumeJobStatus;
  exitCode: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export class BridgeDatabase {
  readonly db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        project_label TEXT NOT NULL,
        cwd TEXT NOT NULL,
        last_turn_id TEXT NOT NULL,
        status TEXT NOT NULL,
        muted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS codex_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        received_at TEXT NOT NULL,
        UNIQUE(session_id, turn_id, event_type)
      );
      CREATE TABLE IF NOT EXISTS telegram_messages (
        chat_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(chat_id, message_id)
      );
      CREATE TABLE IF NOT EXISTS active_targets (
        chat_id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resume_jobs (
        job_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        telegram_message_id INTEGER NOT NULL,
        prompt_redacted_hash TEXT NOT NULL,
        prompt_preview TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        exit_code INTEGER,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
    `);
    this.ensureColumn('resume_jobs', 'prompt_preview', "TEXT NOT NULL DEFAULT ''");
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((entry) => entry.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  recordStopEvent(event: { sessionId: string; turnId: string; project: string; cwd: string }): boolean {
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const change = this.db.prepare(`
        INSERT OR IGNORE INTO codex_events(session_id, turn_id, event_type, status, received_at)
        VALUES (?, ?, 'Stop', 'received', ?)
      `).run(event.sessionId, event.turnId, now);
      if (change.changes === 0) {
        this.db.exec('ROLLBACK');
        return false;
      }
      this.db.prepare(`
        INSERT INTO sessions(session_id, project_label, cwd, last_turn_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'completed', ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          project_label=excluded.project_label, cwd=excluded.cwd,
          last_turn_id=excluded.last_turn_id, status='completed', updated_at=excluded.updated_at
      `).run(event.sessionId, event.project, event.cwd, event.turnId, now, now);
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  mapMessage(chatId: number, messageId: number, sessionId: string, turnId: string, kind = 'completion'): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO telegram_messages(chat_id, message_id, session_id, turn_id, kind, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(chatId, messageId, sessionId, turnId, kind, new Date().toISOString());
  }

  sessionForMessage(chatId: number, messageId: number): string | undefined {
    const row = this.db.prepare(
      'SELECT session_id FROM telegram_messages WHERE chat_id = ? AND message_id = ?',
    ).get(chatId, messageId) as { session_id: string } | undefined;
    return row?.session_id;
  }

  setActiveTarget(chatId: number, sessionId: string): void {
    this.db.prepare(`
      INSERT INTO active_targets(chat_id, session_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        session_id = excluded.session_id, updated_at = excluded.updated_at
    `).run(chatId, sessionId, new Date().toISOString());
  }

  activeTarget(chatId: number): string | undefined {
    const row = this.db.prepare(
      'SELECT session_id FROM active_targets WHERE chat_id = ?',
    ).get(chatId) as { session_id: string } | undefined;
    return row?.session_id;
  }

  getSession(sessionId: string): { sessionId: string; cwd: string; project: string; muted: boolean } | undefined {
    const row = this.db.prepare(
      'SELECT session_id, cwd, project_label, muted FROM sessions WHERE session_id = ?',
    ).get(sessionId) as
      | { session_id: string; cwd: string; project_label: string; muted: number }
      | undefined;
    return row
      ? { sessionId: row.session_id, cwd: row.cwd, project: row.project_label, muted: row.muted === 1 }
      : undefined;
  }

  recentSessions(limit = 5): Array<{ sessionId: string; project: string; cwd: string }> {
    const rows = this.db.prepare(
      'SELECT session_id, project_label, cwd FROM sessions WHERE muted = 0 ORDER BY updated_at DESC LIMIT ?',
    ).all(limit) as Array<{ session_id: string; project_label: string; cwd: string }>;
    return rows.map((row) => ({ sessionId: row.session_id, project: row.project_label, cwd: row.cwd }));
  }

  setMuted(sessionId: string, muted: boolean): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    this.db.prepare('UPDATE sessions SET muted = ?, updated_at = ? WHERE cwd = ?').run(
      muted ? 1 : 0,
      new Date().toISOString(),
      session.cwd,
    );
  }

  mutedProjects(): Array<{ sessionId: string; project: string; cwd: string }> {
    const rows = this.db.prepare(`
      SELECT session_id, project_label, cwd FROM sessions
      WHERE muted = 1 GROUP BY cwd ORDER BY updated_at DESC LIMIT 20
    `).all() as Array<{ session_id: string; project_label: string; cwd: string }>;
    return rows.map((row) => ({ sessionId: row.session_id, project: row.project_label, cwd: row.cwd }));
  }

  createJob(sessionId: string, messageId: number, promptHash: string, promptPreview: string): number {
    const result = this.db.prepare(`
      INSERT INTO resume_jobs(
        session_id, telegram_message_id, prompt_redacted_hash, prompt_preview, status, created_at
      ) VALUES (?, ?, ?, ?, 'queued', ?)
    `).run(sessionId, messageId, promptHash, promptPreview, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  updateJob(jobId: number, status: ResumeJobStatus, exitCode?: number | null): void {
    const now = new Date().toISOString();
    if (status === 'running') {
      this.db.prepare('UPDATE resume_jobs SET status = ?, started_at = ? WHERE job_id = ?').run(status, now, jobId);
    } else {
      this.db.prepare(
        'UPDATE resume_jobs SET status = ?, exit_code = ?, finished_at = ? WHERE job_id = ?',
      ).run(status, exitCode ?? null, now, jobId);
    }
  }

  interruptUnfinishedJobs(): number {
    const result = this.db.prepare(`
      UPDATE resume_jobs
      SET status = 'interrupted', exit_code = NULL, finished_at = ?
      WHERE status IN ('queued', 'running')
    `).run(new Date().toISOString());
    return Number(result.changes);
  }

  recentJobs(limit = 5): ResumeJobSummary[] {
    const rows = this.db.prepare(`
      SELECT j.job_id, j.session_id, COALESCE(s.project_label, 'unknown-project') AS project_label,
             j.prompt_preview, j.status, j.exit_code, j.created_at, j.started_at, j.finished_at
      FROM resume_jobs j
      LEFT JOIN sessions s ON s.session_id = j.session_id
      ORDER BY j.job_id DESC
      LIMIT ?
    `).all(limit) as Array<{
      job_id: number;
      session_id: string;
      project_label: string;
      prompt_preview: string;
      status: ResumeJobStatus;
      exit_code: number | null;
      created_at: string;
      started_at: string | null;
      finished_at: string | null;
    }>;
    return rows.map((row) => ({
      jobId: row.job_id,
      sessionId: row.session_id,
      project: row.project_label,
      promptPreview: row.prompt_preview,
      status: row.status,
      exitCode: row.exit_code,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }));
  }

  countEvents(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM codex_events').get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
