import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: ['token', 'botToken', 'bridgeSecret', 'prompt', '*.token', '*.prompt', 'req.headers.x-bridge-secret'],
      censor: '[REDACTED]',
    },
  });
}
