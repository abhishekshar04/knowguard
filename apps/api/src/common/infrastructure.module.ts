import { Global, Module } from '@nestjs/common';

import { PermissionCatalogSync } from './permission-catalog.sync';
import { PrismaService } from './prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, RateLimiterService, PermissionCatalogSync],
  exports: [PrismaService, RedisService, RateLimiterService],
})
export class InfrastructureModule {}
