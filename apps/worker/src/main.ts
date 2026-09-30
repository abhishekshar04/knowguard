import { homedir } from 'node:os';
import { join } from 'node:path';

import { LocalEmbeddingProvider } from '@knowguard/ai';
import { createPrismaClient } from '@knowguard/database';
import { createLogger } from '@knowguard/logger';
import { S3ObjectStorage } from '@knowguard/storage';
import { INGESTION_JOBS, QUEUE_NAMES } from '@knowguard/types';
import { parseEnv, workerEnvSchema } from '@knowguard/validation';
import { Worker } from 'bullmq';
import Redis from 'ioredis';

import { SectionChunker } from './ingestion/chunker';
import { createIngestionHandler } from './ingestion/handler';
import { JobRegistry } from './jobs/registry';

async function main(): Promise<void> {
  const env = parseEnv(workerEnvSchema, process.env);
  const logger = createLogger({
    name: 'worker',
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === 'development',
  });

  const prisma = createPrismaClient({ url: env.DATABASE_URL });
  const storage = new S3ObjectStorage({
    ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT } : {}),
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  });
  const embeddings = new LocalEmbeddingProvider({
    model: env.EMBEDDING_MODEL,
    cacheDir: env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models'),
    allowRemoteModels: env.EMBEDDING_ALLOW_REMOTE_MODELS,
  });
  // Load the model before taking jobs, so the first document isn't slow and a missing model
  // fails the worker at startup rather than every job.
  await embeddings.warmUp();
  logger.info({ model: embeddings.model, dimensions: embeddings.dimensions }, 'Embedding model loaded');

  const registry = new JobRegistry();
  const ingest = createIngestionHandler({ prisma, storage, embeddings, chunker: new SectionChunker() });
  registry.register(INGESTION_JOBS.processDocument, ingest);
  registry.register(INGESTION_JOBS.reindexDocument, ingest);

  // BullMQ workers require maxRetriesPerRequest: null (blocking commands).
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error: Error) => logger.warn({ err: error.message }, 'Redis connection error'));

  const worker = new Worker(QUEUE_NAMES.ingestion, (job) => registry.dispatch(job, logger), {
    prefix: env.QUEUE_PREFIX,
    connection,
    concurrency: env.WORKER_CONCURRENCY,
  });
  worker.on('ready', () =>
    logger.info({ queue: QUEUE_NAMES.ingestion, handlers: registry.size }, 'Worker ready'),
  );
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, jobName: job?.name, err: error.message }, 'Job failed'),
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down worker');
    await worker.close(); // waits for in-flight jobs to finish
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
