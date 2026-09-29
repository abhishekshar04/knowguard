import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@knowguard/database';

import { API_ENV, type ApiEnv } from '../config/api-env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(API_ENV) env: ApiEnv) {
    super({ datasourceUrl: env.DATABASE_URL, log: ['warn', 'error'] });
  }

  async onModuleInit(): Promise<void> {
    // Don't crash the process if the DB is briefly unavailable at boot; Prisma connects
    // lazily on the next query and /health reports the outage.
    await this.$connect().catch((error: unknown) => {
      this.logger.error(`Initial database connection failed: ${(error as Error).message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
