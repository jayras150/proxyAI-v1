// ProxyAI — Rate Limiter Factory
// Blueprint Reference: Sprint 9 §67 — Rate Limits
//
// Selects the concrete RateLimiter based on environment:
//   RATE_LIMITER_DRIVER=memory  → MemoryRateLimiter (development)
//   RATE_LIMITER_DRIVER=redis   → RedisRateLimiter  (production)
// Default: redis in production (when UPSTASH creds exist), otherwise memory.

import type { RateLimiter } from './types'
import { MemoryRateLimiter } from './memory-rate-limiter'
import { RedisRateLimiter } from './redis-rate-limiter'
import { Redis } from '@upstash/redis'

let instance: RateLimiter | null = null

function resolveDriver(): 'memory' | 'redis' {
  const configured = process.env.RATE_LIMITER_DRIVER
  if (configured === 'memory' || configured === 'redis') {
    return configured
  }

  const hasRedisEnv = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )

  // Production defaults to Redis when credentials are present; otherwise memory.
  return process.env.NODE_ENV === 'production' && hasRedisEnv ? 'redis' : 'memory'
}

export function createRateLimiter(): RateLimiter {
  const driver = resolveDriver()

  if (driver === 'redis') {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return new RedisRateLimiter(redis)
  }

  return new MemoryRateLimiter()
}

/**
 * Lazily-created singleton. Use this everywhere instead of `new`-ing a
 * limiter directly so business logic never cares which implementation runs.
 */
export function getRateLimiter(): RateLimiter {
  if (!instance) {
    instance = createRateLimiter()
  }
  return instance
}
