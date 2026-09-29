import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { ApiException, RateLimitedException } from './api-exception';
import { RedisService } from './redis.service';

export interface RateLimitRule {
  /** Maximum events per window. */
  limit: number;
  windowSeconds: number;
}

const KEY_PREFIX = 'kg:rl:';

/**
 * Fixed-window counters in Redis, shared by all API instances.
 *
 * Fails CLOSED: if Redis is unavailable, rate-limited endpoints (login, registration)
 * return 503 rather than silently dropping brute-force protection.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Atomically records one event (MULTI/EXEC: INCR + first-write EXPIRE) and throws
   * RateLimitedException once the limit is exceeded. Because counting happens before the
   * guarded work, concurrent requests cannot overshoot the limit.
   */
  async consume(key: string, rule: RateLimitRule): Promise<void> {
    const [count, ttl] = await this.run(async () => {
      const results = await this.redis.client
        .multi()
        .incr(KEY_PREFIX + key)
        .expire(KEY_PREFIX + key, rule.windowSeconds, 'NX')
        .ttl(KEY_PREFIX + key)
        .exec();
      if (!results) throw new Error('rate limiter transaction aborted');
      return [Number(results[0]?.[1]), Number(results[2]?.[1])] as const;
    });
    if (count > rule.limit) throw new RateLimitedException(Math.max(ttl, 1));
  }

  async reset(key: string): Promise<void> {
    await this.run(() => this.redis.client.del(KEY_PREFIX + key));
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`Rate limiter unavailable: ${(error as Error).message}`);
      throw new ApiException(
        'SERVICE_UNAVAILABLE',
        'The service is temporarily unavailable. Please try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
