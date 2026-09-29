import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info');

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// connection string');
const redisUrl = z
  .url()
  .refine((value) => /^rediss?:\/\//.test(value), 'must be a redis:// connection string');

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  WEB_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
});
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: ReadonlyArray<string>) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses configuration from `source` (usually `process.env`) and fails fast on startup.
 * Error messages name the variable and the rule only — never the offending value,
 * because values may be secrets (connection strings with passwords, API keys).
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
