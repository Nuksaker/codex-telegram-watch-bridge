import { safeExcerpt, shortId } from '../security/redact.js';

export interface CodexProgressUpdate {
  icon: string;
  message: string;
}

type JsonObject = Record<string, unknown>;

export function parseCodexJsonLine(line: string): CodexProgressUpdate | undefined {
  let event: JsonObject;
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isObject(parsed)) return undefined;
    event = parsed;
  } catch {
    return undefined;
  }

  const type = stringValue(event.type);
  if (type === 'thread.started') return { icon: '🔗', message: 'เชื่อมต่อ Codex session แล้ว' };
  if (type === 'turn.started') return { icon: '▶️', message: 'เริ่มทำงาน' };
  if (type === 'turn.completed') return { icon: '✅', message: 'Codex ทำงานเสร็จแล้ว' };
  if (type === 'turn.failed') return { icon: '❌', message: eventErrorText(event) ?? 'Codex ทำงานล้มเหลว' };
  if (type === 'error') return { icon: '❌', message: eventErrorText(event) ?? 'Codex รายงานข้อผิดพลาด' };

  if (type !== 'item.started' && type !== 'item.completed') return undefined;
  const item = isObject(event.item) ? event.item : undefined;
  if (!item) return undefined;
  const itemType = stringValue(item.type);

  // Do not render reasoning events. The terminal feed is for observable work,
  // not private chain-of-thought or internal model reasoning.
  if (itemType === 'reasoning') return undefined;

  if (itemType === 'command_execution') {
    const command = safeValue(item.command, 180);
    if (type === 'item.started') {
      return command ? { icon: '⚙️', message: `กำลังรัน: ${command}` } : { icon: '⚙️', message: 'กำลังรันคำสั่ง' };
    }
    const exitCode = numberValue(item.exit_code);
    return {
      icon: exitCode === undefined || exitCode === 0 ? '✔️' : '❌',
      message: exitCode === undefined ? 'รันคำสั่งเสร็จแล้ว' : `รันคำสั่งเสร็จ (exit ${exitCode})`,
    };
  }

  if (itemType === 'file_change' && type === 'item.completed') {
    const paths = fileChangePaths(item);
    return {
      icon: '✏️',
      message: paths.length ? `แก้ไขไฟล์: ${paths.join(', ')}` : 'แก้ไขไฟล์แล้ว',
    };
  }

  if (itemType === 'agent_message' && type === 'item.completed') {
    const text = safeValue(item.text, 300);
    return text ? { icon: '💬', message: `Codex: ${text}` } : undefined;
  }

  if (itemType === 'mcp_tool_call') {
    const tool = safeValue(item.tool, 120) ?? safeValue(item.name, 120);
    return type === 'item.started'
      ? { icon: '🧰', message: tool ? `กำลังใช้เครื่องมือ: ${tool}` : 'กำลังใช้เครื่องมือ' }
      : { icon: '✔️', message: tool ? `ใช้เครื่องมือเสร็จ: ${tool}` : 'ใช้เครื่องมือเสร็จแล้ว' };
  }

  if (itemType === 'web_search' && type === 'item.started') {
    const query = safeValue(item.query, 180);
    return { icon: '🔎', message: query ? `กำลังค้นหา: ${query}` : 'กำลังค้นหาข้อมูล' };
  }

  return undefined;
}

export function renderCodexProgress(sessionId: string, update: CodexProgressUpdate): void {
  const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
  if (update.icon === '📥') process.stdout.write('\n────────────────────────────────────────────────────────────\n');
  process.stdout.write(`[${time}] Codex ${shortId(sessionId)} ${update.icon} ${update.message}\n`);
}

export function renderRealtimeViewerReady(): void {
  process.stdout.write([
    '',
    '=== Codex CLI Realtime Viewer ===',
    'เปิดหน้าต่างนี้ค้างไว้ แล้วส่งคำสั่งจาก Telegram หรือ Apple Watch',
    'ไม่ต้องเปิด codex อีกหน้าต่าง เพราะจะเป็นคนละ CLI session',
    '',
  ].join('\n'));
}

function fileChangePaths(item: JsonObject): string[] {
  if (!Array.isArray(item.changes)) return [];
  return item.changes.flatMap((change) => {
    if (!isObject(change)) return [];
    const path = safeValue(change.path, 100);
    return path ? [path] : [];
  }).slice(0, 5);
}

function eventErrorText(event: JsonObject): string | undefined {
  const error = isObject(event.error) ? event.error : undefined;
  return safeValue(error?.message, 240) ?? safeValue(event.message, 240);
}

function safeValue(value: unknown, maxChars: number): string | undefined {
  return typeof value === 'string' && value.trim() ? safeExcerpt(value, maxChars) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
