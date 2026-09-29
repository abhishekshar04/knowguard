import type { PrismaService } from '../common/prisma.service';
import type { RedisService } from '../common/redis.service';
import { HealthService } from './health.service';

function makeService(opts: { db: () => Promise<unknown>; ping: () => Promise<string> }): HealthService {
  const prisma = { $queryRaw: jest.fn(opts.db) } as unknown as PrismaService;
  const redis = { client: { ping: jest.fn(opts.ping) } } as unknown as RedisService;
  return new HealthService(prisma, redis);
}

describe('HealthService', () => {
  it('reports ok when all dependencies respond', async () => {
    const service = makeService({ db: async () => [{ '?column?': 1 }], ping: async () => 'PONG' });
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('reports degraded when the database is down', async () => {
    const service = makeService({
      db: async () => {
        throw new Error('ECONNREFUSED 10.0.0.5:5432');
      },
      ping: async () => 'PONG',
    });
    const result = await service.check();
    expect(result).toMatchObject({ status: 'degraded', checks: { database: 'down', redis: 'up' } });
    // Error details (hosts, ports) must never be exposed through the health payload.
    expect(JSON.stringify(result)).not.toContain('10.0.0.5');
  });

  it('reports degraded when redis is down', async () => {
    const service = makeService({
      db: async () => [],
      ping: async () => {
        throw new Error('Connection is closed.');
      },
    });
    await expect(service.check()).resolves.toMatchObject({ status: 'degraded', checks: { redis: 'down' } });
  });

  it('treats a hanging dependency as down after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const service = makeService({ db: () => new Promise(() => undefined), ping: async () => 'PONG' });
      const pending = service.check();
      await jest.advanceTimersByTimeAsync(2_500);
      await expect(pending).resolves.toMatchObject({ checks: { database: 'down' } });
    } finally {
      jest.useRealTimers();
    }
  });
});
