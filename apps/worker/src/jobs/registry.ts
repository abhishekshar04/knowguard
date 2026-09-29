import type { Logger } from '@knowguard/logger';
import type { Job } from 'bullmq';

export type JobHandler = (job: Job, logger: Logger) => Promise<unknown>;

/**
 * Maps job names to handlers. Ingestion handlers (PROCESS_DOCUMENT, EXTRACT_TEXT, ...)
 * are registered here in Phase 6. Unknown job names fail loudly instead of being
 * silently acknowledged, so a producer/consumer mismatch is visible in the queue.
 */
export class JobRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(name: string, handler: JobHandler): this {
    if (this.handlers.has(name)) throw new Error(`Duplicate handler for job "${name}"`);
    this.handlers.set(name, handler);
    return this;
  }

  async dispatch(job: Job, logger: Logger): Promise<unknown> {
    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
    return handler(job, logger.child({ jobId: job.id, jobName: job.name }));
  }

  get size(): number {
    return this.handlers.size;
  }
}
