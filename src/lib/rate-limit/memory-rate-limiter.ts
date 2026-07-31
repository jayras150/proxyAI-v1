// ProxyAI — In-Memory Rate Limiter
// Development implementation. NOT suitable for multi-instance production
// (state is per-process). Use RedisRateLimiter in production.

import type { RateLimiter, RateLimitResult } from './types'

interface WindowEntry {
  count: number
  resetAt: number // epoch ms when the window resets
}

const DEFAULT_WINDOW_MS = 60_000

export class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, WindowEntry>()
  private readonly cleanupThreshold: number

  constructor(cleanupThreshold = 10_000) {
    // Run cleanup once the store grows beyond this many entries.
    this.cleanupThreshold = cleanupThreshold
  }

  async limit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowMs = windowSeconds * 1000 || DEFAULT_WINDOW_MS

    let entry = this.store.get(key)

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      this.store.set(key, entry)
    }

    entry.count += 1

    if (this.store.size > this.cleanupThreshold) {
      this.cleanup(now)
    }

    const limited = entry.count > limit
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))

    return {
      limited,
      limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSeconds,
    }
  }

  /** Remove expired windows to bound memory usage. */
  private cleanup(now: number): void {
    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) {
        this.store.delete(key)
      }
    }
  }
}
