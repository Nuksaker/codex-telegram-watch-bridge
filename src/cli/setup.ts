import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { Bot } from 'grammy';
import { bridgeConfigSchema } from '../config/schema.js';
import { defaultRuntimeDir, runtimeEnvPath } from '../config/paths.js';

let outputMuted = false;
const guardedOutput = new Writable({
  write(chunk: Buffer | string, encoding, callback) {
    if (!outputMuted) stdout.write(chunk, encoding);
    callback();
  },
});
const prompt = createInterface({ input: stdin, output: guardedOutput, terminal: true });
console.log('Codex Telegram Watch Bridge setup');
console.log('ส่ง /start ให้ bot ใน private chat ก่อนดำเนินการต่อ');
stdout.write('Telegram bot token (ซ่อนระหว่างพิมพ์): ');
outputMuted = true;
const token = (await prompt.question('')).trim();
outputMuted = false;
stdout.write('\n');
const bot = new Bot(token);
const me = await bot.api.getMe();
console.log(`พบ bot: @${me.username}`);
const updates = await bot.api.getUpdates({ limit: 100, timeout: 0 });
const privateMessages = updates.flatMap((update) => {
  const message = update.message;
  return message?.chat.type === 'private'
    ? [{ chatId: message.chat.id, userId: message.from.id, username: message.from.username }]
    : [];
});
const latest = privateMessages.at(-1);
if (!latest) throw new Error('ไม่พบ private message กรุณาส่ง /start ให้ bot แล้วรัน setup ใหม่');
console.log(`ผู้ใช้ล่าสุด: @${latest.username ?? 'unknown'} user=${latest.userId} chat=${latest.chatId}`);
const confirm = (await prompt.question('เป็นบัญชี Telegram ของคุณหรือไม่? [y/N] ')).trim().toLowerCase();
if (confirm !== 'y') throw new Error('ยกเลิกเพื่อป้องกันการตั้งค่า identity ผิดคน');
const runtimeInput = (await prompt.question(`Runtime directory [${defaultRuntimeDir()}]: `)).trim();
prompt.close();
const runtimeDir = runtimeInput || defaultRuntimeDir();
const values = bridgeConfigSchema.parse({
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_ALLOWED_USER_ID: latest.userId,
  TELEGRAM_ALLOWED_CHAT_ID: latest.chatId,
  BRIDGE_SECRET: crypto.randomBytes(32).toString('base64url'),
  BRIDGE_RUNTIME_DIR: runtimeDir,
});
await fs.mkdir(runtimeDir, { recursive: true });
const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}`);
const filename = runtimeEnvPath(runtimeDir);
await fs.writeFile(filename, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`ตั้งค่าเสร็จแล้ว: ${path.dirname(filename)}`);
console.log('ขั้นต่อไป: npm run doctor');
