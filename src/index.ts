import path from 'node:path';
import { readBridgeConfig } from './config/schema.js';
import { createLogger } from './logging.js';
import { BridgeDatabase } from './storage/database.js';
import { GrammyTelegramTransport } from './telegram/bot.js';
import { ProcessCodexRunner } from './codex/resume.js';
import { ResumeQueue } from './codex/queue.js';
import { BridgeService } from './server/bridge-service.js';
import { buildServer } from './server/app.js';
import { EventSpool } from './hook/spool.js';

const config = readBridgeConfig();
const logger = createLogger(config.LOG_LEVEL);
const database = new BridgeDatabase(path.join(config.BRIDGE_RUNTIME_DIR, 'bridge.sqlite'));
const telegram = new GrammyTelegramTransport(
  config.TELEGRAM_BOT_TOKEN,
  config.TELEGRAM_ALLOWED_USER_ID,
  config.TELEGRAM_ALLOWED_CHAT_ID,
  logger,
);
const runner = new ProcessCodexRunner(config.CODEX_BIN, config.MAX_PROMPT_CHARS);
const queue = new ResumeQueue(database, runner, config.GLOBAL_CONCURRENCY);
const service = new BridgeService(config, database, telegram, queue, logger);
const app = buildServer(config, service, logger);
const spool = new EventSpool(config.BRIDGE_RUNTIME_DIR);

await app.listen({ host: config.BRIDGE_HOST, port: config.BRIDGE_PORT });
const interruptedJobs = database.interruptUnfinishedJobs();
if (interruptedJobs > 0) {
  logger.warn({ interruptedJobs }, 'Marked unfinished jobs as interrupted after bridge restart');
}
await telegram.start((message) => service.handleTelegramText(message));
if (interruptedJobs > 0) {
  await telegram.sendText(
    config.TELEGRAM_ALLOWED_CHAT_ID,
    `⚠️ Bridge เพิ่งเริ่มใหม่ งานที่ค้างอยู่ ${interruptedJobs} งานถูกหยุดแล้ว\nใช้ /jobs เพื่อตรวจรายการและส่งคำสั่งใหม่`,
  ).catch((error: unknown) => logger.warn({ err: error }, 'Unable to report interrupted jobs'));
}
const drain = async (): Promise<void> => {
  await spool.drain(async (event) => {
    try {
      await service.handleStop(event);
      return true;
    } catch (error) {
      logger.warn({ err: error }, 'Unable to drain spooled event');
      return false;
    }
  });
};
await drain();
const drainTimer = setInterval(() => void drain(), 30_000);
drainTimer.unref();

const shutdown = async (): Promise<void> => {
  clearInterval(drainTimer);
  await telegram.stop();
  await app.close();
  database.close();
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
