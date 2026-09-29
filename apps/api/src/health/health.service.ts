import { Injectable } from '@nestjs/common';
import type { DependencyStatus, HealthResponse } from '@knowguard/types';

import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

const CHECK_TIMEOUT_MS = 2_000;

async function probe(check: () => Promise<unknown>): Promise<DependencyStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(async () => {
        if ((await this.redis.client.ping()) !== 'PONG') throw new Error('unexpected PING reply');
      }),
    ]);
    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '0.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    };
  }
}
