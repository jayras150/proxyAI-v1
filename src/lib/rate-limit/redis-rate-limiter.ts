// ProxyAI — Redis Rate Limiter
// Production implementation (Upstash Redis REST, works on serverless/Vercel).
// Uses an atomic fixed-window: INCR + EXPIRE-on-first.

import { Redis } from '@upstash/redis'
import type { RateLimiter, RateLimitResult } from './types'

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async limit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = await this.redis.incr(key)

    if (count === 1) {
      // First request in the window — set expiry so the key auto-clears.
      await this.redis.expire(key, windowSeconds)
    }

    const limited = count > limit

    return {
      limited,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: windowSeconds,
    }
  }
}
