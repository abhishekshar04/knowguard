import type { ProcessDocumentJob } from '@knowguard/types';
import { type Job, UnrecoverableError } from 'bullmq';

import type { JobHandler } from '../jobs/registry';
import { IngestionError } from './blocks';
import { type IngestionDeps, markFailed, processDocument } from './process-document';

/**
 * BullMQ handler for PROCESS_DOCUMENT and REINDEX_DOCUMENT.
 *  - Non-retryable IngestionErrors (unsupported, corrupt, empty) fail immediately.
 *  - Other errors are retried with backoff; the document is marked FAILED only on the last try.
 */
export function createIngestionHandler(deps: Omit<IngestionDeps, 'logger'>): JobHandler {
  return async (job: Job, logger) => {
    const data = job.data as ProcessDocumentJob;
    try {
      const outcome = await processDocument({ ...deps, logger }, data);
      if (outcome.status === 'skipped') logger.info({ reason: outcome.reason }, 'Ingestion skipped');
      return outcome;
    } catch (error) {
      const permanent = error instanceof IngestionError && !error.retryable;
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      logger.warn(
        {
          err: (error as Error).message,
          cause: ((error as Error).cause as Error | undefined)?.message,
          permanent,
          lastAttempt,
        },
        'Ingestion failed',
      );
      if (permanent || lastAttempt) await markFailed(deps.prisma, data, error);
      if (permanent) throw new UnrecoverableError((error as Error).message);
      throw error;
    }
  };
}
