import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

/**
 * Structured logger. Pretty in dev (if pino-pretty is installed), JSON in prod.
 * Redacts known-sensitive keys so we never leak the BlueBubbles password or tokens.
 */
export const logger = pino({
  level,
  redact: {
    paths: [
      'password',
      'credentialsEncrypted',
      'webhookSecret',
      'authorization',
      '*.password',
      '*.token',
      'req.headers.authorization',
    ],
    censor: '[redacted]',
  },
});

export type Logger = typeof logger;
