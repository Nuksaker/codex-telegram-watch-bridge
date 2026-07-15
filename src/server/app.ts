import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import type { Logger } from 'pino';
import type { BridgeConfig } from '../config/schema.js';
import type { BridgeService } from './bridge-service.js';
import { stopEventSchema } from '../security/validate.js';

function secretMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildServer(config: BridgeConfig, service: BridgeService, logger: Logger) {
  const app = Fastify({ loggerInstance: logger });
  app.get('/health/live', () => ({ status: 'live' }));
  app.get('/health/ready', () => ({ status: 'ready' }));
  app.post('/v1/events/codex/stop', async (request, reply) => {
    if (!secretMatches(request.headers['x-bridge-secret'] as string | undefined, config.BRIDGE_SECRET)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const parsed = stopEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_event' });
    const result = await service.handleStop(parsed.data);
    return reply.code(result.duplicate ? 200 : 202).send(result);
  });
  return app;
}
