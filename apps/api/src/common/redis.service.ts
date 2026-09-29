import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { API_ENV, type ApiEnv } from '../config/api-env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      // Fail fast instead of queueing commands while disconnected; ioredis keeps reconnecting.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
    });
    this.client.on('error', (error: Error) => this.logger.warn(`Redis error: ${error.message}`));
  }

  async onModuleInit(): Promise<void> {
    // Connect before serving traffic; without the offline queue, commands issued
    // mid-handshake would fail. A failure here is non-fatal: ioredis keeps retrying
    // and /health reports the outage.
    await this.client.connect().catch((error: unknown) => {
      this.logger.error(`Initial Redis connection failed: ${(error as Error).message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
