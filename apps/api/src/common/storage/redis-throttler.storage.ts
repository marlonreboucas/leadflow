import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 2000,
      enableOfflineQueue: false,
    });
  }

  async increment(
    key: string,
    ttl: number,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    try {
      const totalHits = await this.redis.incr(`throttle:${key}`);
      if (totalHits === 1) {
        await this.redis.pexpire(`throttle:${key}`, ttl);
      }
      const timeToExpire = Math.max(0, await this.redis.pttl(`throttle:${key}`));
      return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    } catch {
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  onModuleDestroy() {
    void this.redis.quit();
  }
}
