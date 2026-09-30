import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info');

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// connection string');
const redisUrl = z
  .url()
  .refine((value) => /^rediss?:\/\//.test(value), 'must be a redis:// connection string');

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/** S3-compatible object storage (SeaweedFS/MinIO locally, S3/R2/… in production). */
const storageEnvShape = {
  /** Omit for AWS S3; set for self-hosted S3-compatible stores. */
  STORAGE_ENDPOINT: z.url().optional(),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'must be a valid S3 bucket name'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: booleanFlag,
  /** Create the bucket on startup if missing. Development/test convenience only. */
  STORAGE_AUTO_CREATE_BUCKET: booleanFlag,
};

/**
 * BullMQ key prefix. Environments sharing one Redis (dev, tests, CI) use different prefixes so
 * a worker never consumes another environment's jobs.
 */
const queueEnvShape = {
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,40}$/, 'must be lowercase letters, digits and hyphens')
    .default('knowguard'),
};

/** Local embedding model (ADR 0009). Shared by the worker (documents) and, later, the API (queries). */
export const embeddingEnvShape = {
  EMBEDDING_MODEL: z.string().min(1).default('Xenova/bge-small-en-v1.5'),
  /** Model file cache. Defaults to ~/.cache/knowguard/models when unset. */
  EMBEDDING_CACHE_DIR: z.string().min(1).optional(),
  /**
   * Allow downloading the model from the Hugging Face Hub when it is not cached. Set false in
   * production after pre-provisioning the cache, so the worker needs no outbound network.
   */
  EMBEDDING_ALLOW_REMOTE_MODELS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Cross-encoder used to rerank search candidates (ADR 0010); "none" disables reranking. */
  RERANKER_MODEL: z.string().min(1).default('Xenova/bge-reranker-base'),
};

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  /** Absolute session lifetime. */
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .default(168),
  /** Sessions unused for this long expire even before the absolute lifetime. */
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(60 * 24 * 30)
    .default(60 * 24),
  /**
   * Which upstream hops may set X-Forwarded-For (Express "trust proxy"). The Next.js BFF
   * is the only intended caller; "loopback" fits local development. In production set it
   * to the BFF's address/subnet so clients cannot spoof their IP for rate limiting.
   */
  TRUST_PROXY: z.string().min(1).default('loopback'),
  ...storageEnvShape,
  ...queueEnvShape,
  ...embeddingEnvShape,
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(512).default(25),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  /** Ingestion is CPU-bound (parsing + embedding); keep this near the number of cores. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(2),
  ...storageEnvShape,
  ...queueEnvShape,
  ...embeddingEnvShape,
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
