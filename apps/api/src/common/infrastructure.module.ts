import { Global, Module } from '@nestjs/common';

import { IngestionQueue } from './ingestion-queue';
import { PermissionCatalogSync } from './permission-catalog.sync';
import { PrismaService } from './prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { RedisService } from './redis.service';
import { OBJECT_STORAGE, objectStorageProvider, StorageBootstrap } from './storage.provider';

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    RateLimiterService,
    PermissionCatalogSync,
    objectStorageProvider,
    StorageBootstrap,
    IngestionQueue,
  ],
  exports: [PrismaService, RedisService, RateLimiterService, OBJECT_STORAGE, IngestionQueue],
})
export class InfrastructureModule {}
