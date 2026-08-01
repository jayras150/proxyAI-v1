// ProxyAI — Wallet API Route Tests (GET /api/v1/wallet/topups, POST topups, GET topups/:id)
// Uses in-memory fakes (no DB).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { makeRequest, signAccessToken, FakeWalletRepo, FakeTxRepo } from './test-helpers'
import { Prisma } from '@prisma/client'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import { WalletService } from '@/server/wallet/wallet.service'
import { TransactionService } from '@/server/transactions/transaction.service'
import { TopupService } from '@/server/topup/topup.service'
import { IdempotencyService } from '@/server/idempotency/idempotency.service'
import { PaymentService } from '@/server/payments/payment.service'
import { WebhookService } from '@/server/webhooks/webhook.service'
import { MockProvider, MOCK_SIGNATURE_HEADER, MOCK_EVENT_ID_HEADER } from '@/server/payments/mock-provider'
import type { TopupRequest, TopupStatus } from '@prisma/client'
import type { TxClient } from '@/server/db/transaction-manager'
import type { TopupRequestRepository } from '@/server/topup/topup-request.repository'
import type { WebhookEventRepository } from '@/server/webhooks/webhook-event.repository'
import type { IdempotencyKeyRepository } from '@/server/idempotency/idempotency-key.repository'
import type { WebhookEvent } from '@prisma/client'

// ── Fakes ─────────────────────────────────────────────────────────────────

class FakeTopupRepo implements TopupRequestRepository {
  rows = new Map<string, TopupRequest>()
  seq = 0

  async create(input: { userId: string; walletId: string; amount: Prisma.Decimal; currency: string; provider: TopupRequest['provider']; expiresAt: Date }) {
    const r: TopupRequest = {
      id: `topup-${++this.seq}`, userId: input.userId, walletId: input.walletId,
      amount: input.amount, currency: input.currency as TopupRequest['currency'],
      status: 'PENDING', provider: input.provider, providerReference: null,
      transactionId: null, expiresAt: input.expiresAt, createdAt: new Date(), updatedAt: new Date(),
    }
    this.rows.set(r.id, r)
    return r
  }
  async findByIdAndUserId(id: string, userId: string) { const r = this.rows.get(id); return r && r.userId === userId ? r : null }
  async findById(id: string) { return this.rows.get(id) ?? null }
  async findByProviderReference(ref: string) { for (const r of this.rows.values()) if (r.providerReference === ref) return r; return null }
  async updateProviderReference(id: string, ref: string) { const r = this.rows.get(id)!; this.rows.set(id, { ...r, providerReference: ref }); return this.rows.get(id)! }
  async updateStatus(id: string, status: TopupStatus) { const r = this.rows.get(id)!; this.rows.set(id, { ...r, status }); return this.rows.get(id)! }
  async markPaid(id: string, transactionId: string) {
    const r = this.rows.get(id)
    if (!r || r.status !== 'PENDING') return null
    this.rows.set(id, { ...r, status: 'PAID', transactionId })
    return this.rows.get(id)!
  }
  async findByUserIdPaginated(_userId: string, _cursor: { createdAt: Date; id: string } | null, _limit: number) {
    const all = Array.from(this.rows.values()).filter((r) => r.userId === _userId)
    const sorted = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const items = _cursor ? sorted.filter((r) => r.createdAt < _cursor.createdAt) : sorted
    const sliced = items.slice(0, _limit)
    return {
      items: sliced,
      nextCursor: items.length > _limit ? { createdAt: sliced[sliced.length - 1].createdAt, id: sliced[sliced.length - 1].id } : null,
      hasMore: items.length > _limit,
    }
  }
  async markExpired(id: string) {
    const r = this.rows.get(id)
    if (!r || r.status !== 'PENDING') return null
    this.rows.set(id, { ...r, status: 'EXPIRED' })
    return this.rows.get(id)!
  }
}

class FakeIdempotencyRepo implements IdempotencyKeyRepository {
  rows = new Map<string, { id: string; key: string; scope: string; userId: string; requestHash: string; response: unknown; status: 'PENDING' | 'COMPLETED'; expiresAt: Date }>()
  seq = 0
  async findActive(key: string, scope: string, userId: string, now: Date) {
    for (const r of this.rows.values()) if (r.key === key && r.scope === scope && r.userId === userId && r.expiresAt > now) return r as never
    return null
  }
  async create(input: { key: string; scope: string; userId: string; requestHash: string; expiresAt: Date }) {
    const r = { id: `ikey-${++this.seq}`, ...input, response: null, status: 'PENDING' as const }
    this.rows.set(r.id, r)
    return r as never
  }
  async complete(id: string, response: never) {
    const r = this.rows.get(id)!
    this.rows.set(id, { ...r, status: 'COMPLETED', response })
    return r as never
  }
  async deleteExpired(now: Date) { void now; return 0 }
}

class FakeWebhookRepo implements WebhookEventRepository {
  rows = new Map<string, WebhookEvent>()
  seq = 0
  async create(input: { provider: WebhookEvent['provider']; providerEventId: string; payloadHash: string }) {
    const r: WebhookEvent = { id: `evt-${++this.seq}`, provider: input.provider, providerEventId: input.providerEventId, payloadHash: input.payloadHash, payload: null, status: 'RECEIVED', error: null, receivedAt: new Date(), processedAt: null }
    this.rows.set(r.id, r)
    return r
  }
  async findByProviderEventId(provider: WebhookEvent['provider'], providerEventId: string) {
    for (const r of this.rows.values()) if (r.provider === provider && r.providerEventId === providerEventId) return r
    return null
  }
  async markProcessed(id: string) { const r = this.rows.get(id)!; this.rows.set(id, { ...r, status: 'PROCESSED', processedAt: new Date() }); return this.rows.get(id)! }
  async markFailed(id: string, error: string) { const r = this.rows.get(id)!; this.rows.set(id, { ...r, status: 'FAILED', error }); return this.rows.get(id)! }
}

const fakeTxManager = {
  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> { return fn({} as TxClient) },
}

// ── Composition mock ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockServices: any
let walletRepo: FakeWalletRepo
let txRepo: FakeTxRepo
let topupRepo: FakeTopupRepo
let webhookRepo: FakeWebhookRepo
let idempotencyRepo: FakeIdempotencyRepo

vi.mock('@/server/composition', () => ({
  getApiServices: () => mockServices,
}))

beforeEach(async () => {
  vi.resetModules()
  walletRepo = new FakeWalletRepo()
  txRepo = new FakeTxRepo()
  topupRepo = new FakeTopupRepo()
  webhookRepo = new FakeWebhookRepo()
  idempotencyRepo = new FakeIdempotencyRepo()

  const dispatcher = new LocalEventDispatcher()
  const txManager = fakeTxManager
  const walletService = new WalletService(walletRepo, txRepo, txManager, dispatcher)
  const paymentService = new PaymentService(new MockProvider())
  const topupService = new TopupService(topupRepo, walletService, paymentService, txManager)
  const idempotencyService = new IdempotencyService(idempotencyRepo)
  const webhookService = new WebhookService(
    paymentService,
    walletService,
    topupService,
    webhookRepo,
    txManager,
    dispatcher
  )

  mockServices = {
    walletService,
    transactionService: { getWalletHistory: async () => ({ items: [], nextCursor: null, hasMore: false }) },
    topupService,
    idempotencyService,
    paymentService,
    webhookService,
  }

  return walletRepo.create('user-1', 'USD')
})

async function importRoutes() {
  const topupsRoute = await import('./wallet/topups/route')
  const topupIdRoute = await import('./wallet/topups/[id]/route')
  const webhookRoute = await import('./webhooks/payments/route')
  return { topupsRoute, topupIdRoute, webhookRoute }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/wallet/topups', () => {
  it('creates a topup request with payment intent', async () => {
    const { topupsRoute } = await importRoutes()
    const res = await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        headers: { 'x-idempotency-key': 'key-1' },
        body: { amount: '50.00' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.topup.status).toBe('PENDING')
    expect(body.data.topup.amount).toBe('50.000000')
    expect(body.data.payment.checkout_url).toContain('mock_')
  })

  it('rejects missing idempotency key', async () => {
    const { topupsRoute } = await importRoutes()
    const res = await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        body: { amount: '50.00' },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid amount (not a decimal string)', async () => {
    const { topupsRoute } = await importRoutes()
    const res = await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        headers: { 'x-idempotency-key': 'key-2' },
        body: { amount: 50 }, // number, not string
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('requires auth (401)', async () => {
    const { topupsRoute } = await importRoutes()
    const res = await topupsRoute.POST(makeRequest('http://test/api/v1/wallet/topups', { method: 'POST' }))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/wallet/topups', () => {
  it('lists topups with cursor pagination', async () => {
    // Create a topup first
    const { topupsRoute } = await importRoutes()
    await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        headers: { 'x-idempotency-key': 'key-list-1' },
        body: { amount: '25.00' },
      })
    )

    const res = await topupsRoute.GET(
      makeRequest('http://test/api/v1/wallet/topups?limit=10', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].amount).toBe('25.000000')
    expect(body.data.items[0].status).toBe('PENDING')
  })

  it('requires auth', async () => {
    const { topupsRoute } = await importRoutes()
    const res = await topupsRoute.GET(makeRequest('http://test/api/v1/wallet/topups'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/wallet/topups/:id', () => {
  it('returns topup status for polling', async () => {
    const { topupsRoute, topupIdRoute } = await importRoutes()
    const createRes = await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        headers: { 'x-idempotency-key': 'key-poll-1' },
        body: { amount: '75.00' },
      })
    )
    const created = await createRes.json()
    const topupId = created.data.topup.id

    const req = makeRequest(`http://test/api/v1/wallet/topups/${topupId}`, {
      token: signAccessToken(),
    })
    const res = await topupIdRoute.GET(req, { params: Promise.resolve({ id: topupId }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.status).toBe('PENDING')
    expect(body.data.id).toBe(topupId)
  })
})

describe('POST /api/v1/webhooks/payments', () => {
  it('credits wallet on valid payment notification', async () => {
    const { topupsRoute, webhookRoute } = await importRoutes()
    const mockProvider = new MockProvider()

    // Create a topup
    const createRes = await topupsRoute.POST(
      makeRequest('http://test/api/v1/wallet/topups', {
        method: 'POST',
        token: signAccessToken(),
        headers: { 'x-idempotency-key': 'key-web-1' },
        body: { amount: '100.00' },
      })
    )
    const created = await createRes.json()
    const providerRef = created.data.payment.provider_reference

    // Simulate a signed payment webhook
    const webhook = mockProvider.simulateWebhook({
      providerReference: providerRef,
      amount: '100.00',
      currency: 'USD',
      status: 'PAID',
    })

    // Build the webhook request directly (avoid JSON.stringify double-encoding)
    const webhookHeaders = new Headers({
      [MOCK_SIGNATURE_HEADER]: webhook.signature,
      [MOCK_EVENT_ID_HEADER]: webhook.headers[MOCK_EVENT_ID_HEADER],
      'content-type': 'application/json',
    })
    const webhookReq = new NextRequest('http://test/api/v1/webhooks/payments', {
      method: 'POST',
      headers: webhookHeaders,
      body: webhook.rawBody,
    })
    const res = await webhookRoute.POST(webhookReq)
    expect(res.status).toBe(200)

    // Wallet should reflect credit
    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toFixed()).toBe('100')
  })
})
