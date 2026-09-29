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

  /** Records one event and throws RateLimitedException once the limit is exceeded. */
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

  /** Throws if the counter is already at/over the limit, without recording an event. */
  async assertBelow(key: string, rule: RateLimitRule): Promise<void> {
    const [count, ttl] = await this.run(async () => {
      const results = await this.redis.client
        .multi()
        .get(KEY_PREFIX + key)
        .ttl(KEY_PREFIX + key)
        .exec();
      if (!results) throw new Error('rate limiter transaction aborted');
      return [Number(results[0]?.[1] ?? 0), Number(results[1]?.[1])] as const;
    });
    if (count >= rule.limit) throw new RateLimitedException(Math.max(ttl, 1));
  }

  /** Records one event without enforcing (e.g. a failed login counted after the fact). */
  async record(key: string, rule: RateLimitRule): Promise<void> {
    await this.run(() =>
      this.redis.client
        .multi()
        .incr(KEY_PREFIX + key)
        .expire(KEY_PREFIX + key, rule.windowSeconds, 'NX')
        .exec(),
    );
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
