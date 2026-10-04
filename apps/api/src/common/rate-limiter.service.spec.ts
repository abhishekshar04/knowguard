import { ApiException, RateLimitedException } from './api-exception';
import { RateLimiterService } from './rate-limiter.service';
import type { RedisService } from './redis.service';

type ExecResult = Array<[Error | null, unknown]>;

function limiterWith(exec: () => Promise<ExecResult | null>) {
  const chain = { incr: () => chain, expire: () => chain, ttl: () => chain, exec };
  const redis = { client: { multi: () => chain, del: jest.fn() } } as unknown as RedisService;
  return new RateLimiterService(redis);
}

const rule = { limit: 3, windowSeconds: 60 };

describe('RateLimiterService', () => {
  it('allows events up to the limit', async () => {
    const limiter = limiterWith(async () => [
      [null, 3],
      [null, 1],
      [null, 42],
    ]);
    await expect(limiter.consume('k', rule)).resolves.toBeUndefined();
  });

  it('throws RateLimited with Retry-After once the limit is exceeded', async () => {
    const limiter = limiterWith(async () => [
      [null, 4],
      [null, 0],
      [null, 42],
    ]);
    const error = await limiter.consume('k', rule).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitedException);
    expect((error as RateLimitedException).retryAfterSeconds).toBe(42);
  });

  it('fails CLOSED with 503 when Redis is unavailable', async () => {
    const limiter = limiterWith(async () => {
      throw new Error('Connection is closed.');
    });
    const error = await limiter.consume('k', rule).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(503);
    expect((error as ApiException).message).not.toContain('Connection');
  });

  it('fails OPEN when asked to (broad API limits), still enforcing the limit when Redis works', async () => {
    const down = limiterWith(async () => {
      throw new Error('Connection is closed.');
    });
    await expect(down.consume('k', rule, { failOpen: true })).resolves.toBeUndefined();

    const over = limiterWith(async () => [
      [null, 4],
      [null, 1],
      [null, 30],
    ]);
    await expect(over.consume('k', rule, { failOpen: true })).rejects.toBeInstanceOf(RateLimitedException);
  });
});
