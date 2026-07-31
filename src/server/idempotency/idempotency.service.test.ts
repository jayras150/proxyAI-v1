// ProxyAI — IdempotencyService Unit Tests

import { describe, it, expect, beforeEach } from 'vitest'
import { IdempotencyService, IdempotencyError } from '@/server/idempotency/idempotency.service'
import type { IdempotencyKey } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { IdempotencyKeyRepository } from '@/server/idempotency/idempotency-key.repository'

class FakeIdempotencyRepo implements IdempotencyKeyRepository {
  rows = new Map<string, IdempotencyKey>()
  seq = 0

  async findActive(key: string, scope: string, userId: string, now: Date) {
    for (const r of this.rows.values()) {
      if (r.key === key && r.scope === scope && r.userId === userId && r.expiresAt > now) return r
    }
    return null
  }

  async create(input: { key: string; scope: string; userId: string; requestHash: string; expiresAt: Date }) {
    const row: IdempotencyKey = {
      id: `ikey-${++this.seq}`,
      key: input.key,
      scope: input.scope,
      userId: input.userId,
      requestHash: input.requestHash,
      response: null,
      status: 'PENDING',
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.rows.set(row.id, row)
    return row
  }

  async complete(id: string, response: Prisma.InputJsonValue) {
    const r = this.rows.get(id)!
    r.status = 'COMPLETED'
    r.response = response as Prisma.JsonValue
    return r
  }

  async deleteExpired(now: Date) {
    let count = 0
    for (const [id, r] of this.rows) {
      if (r.expiresAt <= now) {
        this.rows.delete(id)
        count++
      }
    }
    return count
  }
}

let repo: FakeIdempotencyRepo
let service: IdempotencyService

beforeEach(() => {
  repo = new FakeIdempotencyRepo()
  service = new IdempotencyService(repo)
})

const req = (amount: number) => ({ userId: 'u1', amount })

describe('IdempotencyService', () => {
  it('reserves a new key and completes with stored response', async () => {
    const reservation = await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    expect(reservation.state).toBe('reserved')

    await service.complete((reservation as { id: string }).id, { ok: true, id: 'txn-1' })

    // Same request again → replay with stored response
    const replay = await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    expect(replay.state).toBe('replay')
    const response = (replay as { response: unknown }).response as { ok: boolean }
    expect(response).toEqual({ ok: true, id: 'txn-1' })
  })

  it('rejects same key with a different request body', async () => {
    await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    await expect(
      service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(20) })
    ).rejects.toThrow(IdempotencyError)
  })

  it('rejects a concurrent in-progress request with the same key', async () => {
    await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    await expect(
      service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    ).rejects.toMatchObject({ code: 'IN_PROGRESS' })
  })

  it('treats the same key in different scopes as independent', async () => {
    const a = await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    const b = await service.reserve({ key: 'k1', scope: 'billing:usage', userId: 'u1', request: req(10) })
    expect(a.state).toBe('reserved')
    expect(b.state).toBe('reserved')
  })

  it('expired keys are treated as absent and can be cleaned up', async () => {
    await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10), ttlMs: -1000 })
    // Expired → not found as active
    const again = await service.reserve({ key: 'k1', scope: 'wallet:topup', userId: 'u1', request: req(10) })
    expect(again.state).toBe('reserved')

    const removed = await service.cleanupExpired()
    expect(removed).toBeGreaterThan(0)
  })
})
