// ProxyAI — Rate Limit Identity Tests (P2)
// Authenticated endpoints must be keyed by userId (not shared IP).

import { describe, it, expect } from 'vitest'
import { MemoryRateLimiter } from '@/lib/rate-limit/memory-rate-limiter'
import { buildRateLimitKey } from '@/lib/rate-limit/helpers'

describe('Rate limiter identity separation (P2)', () => {
  const limiter = new MemoryRateLimiter()

  it('different user identities get independent buckets', async () => {
    const keyA = buildRateLimitKey('wallet:read', 'user-a')
    const keyB = buildRateLimitKey('wallet:read', 'user-b')

    // Exhaust user A's limit.
    for (let i = 0; i < 3; i++) {
      const r = await limiter.limit(keyA, 3, 60)
      expect(r.limited).toBe(i >= 3)
    }

    // User B is unaffected.
    const b = await limiter.limit(keyB, 3, 60)
    expect(b.limited).toBe(false)
    expect(b.remaining).toBe(2)
  })

  it('same identity + same scope shares a bucket', async () => {
    const key = buildRateLimitKey('wallet:read', 'user-a')
    const r = await limiter.limit(key, 3, 60)
    // user-a already exhausted from the previous test — still limited.
    expect(r.limited).toBe(true)
  })

  it('same identity in different scopes has separate buckets', async () => {
    const read = buildRateLimitKey('wallet:read', 'user-c')
    const topup = buildRateLimitKey('wallet:topup', 'user-c')

    const r1 = await limiter.limit(read, 1, 60)
    expect(r1.limited).toBe(false)

    const r2 = await limiter.limit(topup, 1, 60)
    expect(r2.limited).toBe(false) // not affected by read bucket
  })

  it('IP fallback still works when no identity is provided', async () => {
    const key = buildRateLimitKey('webhook:payments', 'ip:203.0.113.7')
    const r1 = await limiter.limit(key, 1, 60)
    expect(r1.limited).toBe(false)
    const r2 = await limiter.limit(key, 1, 60)
    expect(r2.limited).toBe(true)
  })
})
