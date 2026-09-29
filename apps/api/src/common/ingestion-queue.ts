import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { INGESTION_JOBS, type ProcessDocumentJob, QUEUE_NAMES } from '@knowguard/types';
import { Queue } from 'bullmq';

import { API_ENV, type ApiEnv } from '../config/api-env';

/**
 * Producer side of the ingestion queue (spec §17). The worker consumes it from Phase 6.
 * Job IDs are derived from the version ID, so enqueuing the same version twice is a no-op.
 */
@Injectable()
export class IngestionQueue implements OnModuleDestroy {
  private readonly logger = new Logger(IngestionQueue.name);
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    const url = new URL(env.REDIS_URL);
    this.queue = new Queue(QUEUE_NAMES.ingestion, {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        // Fail fast rather than hang the upload request if Redis is down.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
    this.queue.on('error', (error: Error) => this.logger.warn(`Queue error: ${error.message}`));
  }

  /** Returns false (and logs) instead of throwing: the upload itself already succeeded. */
  async enqueueProcessDocument(job: ProcessDocumentJob): Promise<boolean> {
    try {
      await this.queue.add(INGESTION_JOBS.processDocument, job, { jobId: `process-${job.versionId}` });
      return true;
    } catch (error) {
      this.logger.error(
        `Could not enqueue ${INGESTION_JOBS.processDocument} for version ${job.versionId}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
