import pino, { type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/**
 * Paths that must never reach log output. pino replaces them with "[REDACTED]".
 * Extend this list rather than relying on call sites to remember.
 */
export const REDACT_PATHS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'secret',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
] as const;

export interface CreateLoggerOptions {
  /** Service name, e.g. "api" or "worker". */
  name: string;
  level?: LoggerOptions['level'];
  /** Human-readable output for local development. JSON otherwise. */
  pretty?: boolean;
}

export function createLogger({ name, level = 'info', pretty = false }: CreateLoggerOptions): Logger {
  return pino({
    name,
    level,
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
