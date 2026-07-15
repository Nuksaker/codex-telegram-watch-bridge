import type { CompletionNotice } from '../types.js';
import { shortId } from '../security/redact.js';

export function completionText(notice: CompletionNotice): string {
  const icon = notice.status === 'completed' ? '✅' : notice.status === 'blocked' ? '⏸️' : '❌';
  const elapsed = notice.elapsedMs === undefined ? '' : `\nใช้เวลา: ${formatDuration(notice.elapsedMs)}`;
  return `${icon} Codex ทำงานเสร็จแล้ว

โปรเจกต์: ${notice.project}
สถานะ: ${notice.status}
Session: ${shortId(notice.sessionId)}${elapsed}

สิ่งที่ทำเสร็จ:
${notice.excerpt}

สั่งต่อจาก Watch: ถ้ามี session เดียว ส่งข้อความได้เลย
ถ้ามีหลาย session ใช้ /use <ลำดับ> ก่อน`;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
