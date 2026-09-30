import { createLogger } from '@knowguard/logger';
import { QUEUE_NAMES } from '@knowguard/types';
import { parseEnv, workerEnvSchema } from '@knowguard/validation';
import { Worker } from 'bullmq';
import Redis from 'ioredis';

import { JobRegistry } from './jobs/registry';

async function main(): Promise<void> {
  const env = parseEnv(workerEnvSchema, process.env);
  const logger = createLogger({
    name: 'worker',
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === 'development',
  });

  // BullMQ workers require maxRetriesPerRequest: null (blocking commands).
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error: Error) => logger.warn({ err: error.message }, 'Redis connection error'));

  // Handlers are registered here as phases land (ingestion in Phase 6).
  const registry = new JobRegistry();

  // Without handlers, consuming would pull every queued job and fail it. Leave jobs waiting in
  // Redis instead; they are processed once handlers are registered (and survive restarts).
  const worker =
    registry.size === 0
      ? null
      : new Worker(QUEUE_NAMES.ingestion, (job) => registry.dispatch(job, logger), {
          connection,
          concurrency: env.WORKER_CONCURRENCY,
        });
  if (!worker) {
    logger.info({ queue: QUEUE_NAMES.ingestion }, 'No job handlers registered yet; not consuming the queue');
  } else {
    worker.on('ready', () =>
      logger.info({ queue: QUEUE_NAMES.ingestion, handlers: registry.size }, 'Worker ready'),
    );
    worker.on('failed', (job, error) =>
      logger.error({ jobId: job?.id, jobName: job?.name, err: error.message }, 'Job failed'),
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down worker');
    await worker?.close(); // waits for in-flight jobs to finish
    await connection.quit();
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
