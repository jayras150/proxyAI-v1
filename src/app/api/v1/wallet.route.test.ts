// ProxyAI — Wallet API Route Tests (GET /api/v1/wallet, GET transactions)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeRequest, signAccessToken, FakeWalletRepo, FakeTxRepo } from './test-helpers'
import { Prisma } from '@prisma/client'

// Mock composition so routes hit in-memory fakes, not the DB.
vi.mock('@/server/composition', () => ({
  getApiServices: () => mockServices,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockServices: any
let walletRepo: FakeWalletRepo
let txRepo: FakeTxRepo

async function importRoutes() {
  const walletRoute = await import('./wallet/route')
  const txRoute = await import('./wallet/transactions/route')
  return { walletRoute, txRoute }
}

beforeEach(async () => {
  vi.resetModules()
  walletRepo = new FakeWalletRepo()
  txRepo = new FakeTxRepo()
  await walletRepo.create('user-1', 'USD')

  mockServices = {
    walletService: {
      getWallet: (userId: string) => walletRepo.findByUserId(userId),
    },
    transactionService: {
      getWalletHistory: (walletId: string, cursor: string | null, limit: number) => {
        // Reuse the repository pagination directly.
        const decoded = cursor
          ? (JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
              c: string
              i: string
            })
          : null
        return txRepo
          .findByWalletIdPaginated(
            walletId,
            decoded ? { createdAt: new Date(decoded.c), id: decoded.i } : null,
            limit
          )
          .then((page) => ({
            items: page.items,
            nextCursor: page.nextCursor
              ? Buffer.from(
                  JSON.stringify({ c: page.nextCursor.createdAt.toISOString(), i: page.nextCursor.id })
                ).toString('base64url')
              : null,
            hasMore: page.hasMore,
          }))
      },
    },
  }
})

describe('GET /api/v1/wallet', () => {
  it('returns wallet balance as a decimal STRING', async () => {
    const wallet = await walletRepo.findByUserId('user-1')!
    await walletRepo.credit(wallet!.id, new Prisma.Decimal('12.345'))

    const { walletRoute } = await importRoutes()
    const res = await walletRoute.GET(makeRequest('http://test/api/v1/wallet', { token: signAccessToken() }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.balance).toBe('12.345000') // string, not number
    expect(typeof body.data.balance).toBe('string')
    expect(body.data.currency).toBe('USD')
    expect(body.request_id).toBeTruthy()
  })

  it('returns 401 without a token', async () => {
    const { walletRoute } = await importRoutes()
    const res = await walletRoute.GET(makeRequest('http://test/api/v1/wallet'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.error.details).toEqual({})
  })

  it('returns 404 when the user has no wallet', async () => {
    const { walletRoute } = await importRoutes()
    const res = await walletRoute.GET(
      makeRequest('http://test/api/v1/wallet', { token: signAccessToken({ sub: 'no-wallet' }) })
    )
    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/wallet/transactions', () => {
  it('returns cursor-paginated transactions with has_more', async () => {
    const wallet = await walletRepo.findByUserId('user-1')!
    for (let i = 1; i <= 5; i++) {
      await txRepo.create({
        walletId: wallet!.id,
        userId: 'user-1',
        amount: new Prisma.Decimal(i),
        balanceBefore: new Prisma.Decimal(i - 1),
        balanceAfter: new Prisma.Decimal(i),
        currency: 'USD',
        type: 'TOPUP',
        reference: `ref-${i}`,
      })
    }

    const { txRoute } = await importRoutes()
    const res = await txRoute.GET(
      makeRequest('http://test/api/v1/wallet/transactions?limit=2', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.items).toHaveLength(2)
    expect(body.data.has_more).toBe(true)
    expect(body.data.next_cursor).toBeTruthy()
    // amounts serialized as strings
    expect(typeof body.data.items[0].amount).toBe('string')
  })

  it('rejects invalid limit', async () => {
    const { txRoute } = await importRoutes()
    const res = await txRoute.GET(
      makeRequest('http://test/api/v1/wallet/transactions?limit=9999', {
        token: signAccessToken(),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('requires auth', async () => {
    const { txRoute } = await importRoutes()
    const res = await txRoute.GET(makeRequest('http://test/api/v1/wallet/transactions'))
    expect(res.status).toBe(401)
  })
})
