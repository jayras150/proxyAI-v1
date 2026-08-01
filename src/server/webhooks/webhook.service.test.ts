// ProxyAI — WebhookService Integration Tests
// Full payment flow with MockProvider + in-memory fakes:
//  - valid webhook credits the wallet exactly once
//  - replay of the same event never credits twice
//  - wrong amount / currency are rejected
//  - FAILED status marks topup FAILED without credit
//  - domain events emitted only after commit

import { describe, it, expect, beforeEach } from 'vitest'
import { MockProvider } from '@/server/payments/mock-provider'
import { PaymentService } from '@/server/payments/payment.service'
import { WebhookService } from '@/server/webhooks/webhook.service'
import { WalletService } from '@/server/wallet/wallet.service'
import { TopupService } from '@/server/topup/topup.service'
import { Money } from '@/lib/money'
import { LocalEventDispatcher, createDomainEvent } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TxClient } from '@/server/db/transaction-manager'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, TransactionStatus, TopupRequest, TopupStatus, WebhookEvent } from '@prisma/client'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'
import type { TopupRequestRepository } from '@/server/topup/topup-request.repository'
import type { WebhookEventRepository } from '@/server/webhooks/webhook-event.repository'

// ─── In-memory fakes (same pattern as M2 tests, plus topup + webhook) ───

class FakeWalletRepo implements WalletRepository {
  wallets = new Map<string, Wallet>()

  snapshot() { return new Map(this.wallets) }
  restore(s: unknown) { this.wallets = s as Map<string, Wallet> }

  async findById(id: string) { return this.wallets.get(id) ?? null }
  async findByUserId(userId: string) {
    for (const w of this.wallets.values()) if (w.userId === userId) return w
    return null
  }
  async findByUserIdAndStatus(userId: string, status: Wallet['status']) {
    const w = await this.findByUserId(userId)
    return w && w.status === status ? w : null
  }
  async create(userId: string, currency: Wallet['currency']) {
    const w: Wallet = { id: `wallet-${userId}`, userId, balance: new Prisma.Decimal(0), currency, status: 'ACTIVE', version: 1, createdAt: new Date(), updatedAt: new Date() }
    this.wallets.set(w.id, w)
    return w
  }
  async credit(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    this.wallets.set(id, { ...w, balance: w.balance.plus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }
  async debitIfSufficient(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.lessThan(amount)) return null
    this.wallets.set(id, { ...w, balance: w.balance.minus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }
  async debitWithFloor(id: string, amount: Prisma.Decimal, floor: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.plus(floor).lessThan(amount)) return null
    this.wallets.set(id, { ...w, balance: w.balance.minus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }
  async updateStatus(id: string, status: Wallet['status']) {
    const w = this.wallets.get(id)!
    this.wallets.set(id, { ...w, status })
    return this.wallets.get(id)!
  }
}

class FakeTxRepo implements TransactionRepository {
  transactions: Transaction[] = []
  seq = 0

  snapshot() { return { transactions: [...this.transactions], seq: this.seq } }
  restore(s: unknown) { const snap = s as { transactions: Transaction[]; seq: number }; this.transactions = snap.transactions; this.seq = snap.seq }
  async create(input: TransactionCreateInput) {
    if (this.transactions.some((t) => t.reference === input.reference)) throw new Error('duplicate reference')
    const tx: Transaction = {
      id: `txn-${++this.seq}`, walletId: input.walletId, userId: input.userId, amount: input.amount,
      balanceBefore: input.balanceBefore, balanceAfter: input.balanceAfter, currency: input.currency,
      type: input.type, reference: input.reference, status: (input.status ?? 'COMPLETED') as TransactionStatus,
      description: input.description ?? null, requestId: input.requestId ?? null,
      providerReference: input.providerReference ?? null, createdBy: input.createdBy ?? null,
      ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null, createdAt: new Date(),
    }
    this.transactions.push(tx)
    return tx
  }
  async findByReference(ref: string) { return this.transactions.find((t) => t.reference === ref) ?? null }
  async findByWalletIdPaginated(walletId: string) {
    const items = this.transactions.filter((t) => t.walletId === walletId)
    return { items, nextCursor: null, hasMore: false }
  }
}

class FakeTopupRepo implements TopupRequestRepository {
  rows = new Map<string, TopupRequest>()
  seq = 0

  snapshot() { return { rows: new Map(this.rows), seq: this.seq } }
  restore(s: unknown) { const snap = s as { rows: Map<string, TopupRequest>; seq: number }; this.rows = snap.rows; this.seq = snap.seq }
  async create(input: { userId: string; walletId: string; amount: Prisma.Decimal; currency: string; provider: TopupRequest['provider']; expiresAt: Date }) {
    const r: TopupRequest = { id: `topup-${++this.seq}`, userId: input.userId, walletId: input.walletId, amount: input.amount, currency: input.currency as TopupRequest['currency'], status: 'PENDING', provider: input.provider, providerReference: null, transactionId: null, expiresAt: input.expiresAt, createdAt: new Date(), updatedAt: new Date() }
    this.rows.set(r.id, r)
    return r
  }
  async findByIdAndUserId(id: string, userId: string) { const r = this.rows.get(id); return r && r.userId === userId ? r : null }
  async findById(id: string) { return this.rows.get(id) ?? null }
  async findByProviderReference(ref: string) { for (const r of this.rows.values()) if (r.providerReference === ref) return r; return null }
  async updateProviderReference(id: string, ref: string) { const r = this.rows.get(id)!; r.providerReference = ref; return r }
  async updateStatus(id: string, status: TopupStatus) {
    const r = this.rows.get(id)!
    this.rows.set(id, { ...r, status })
    return this.rows.get(id)!
  }
  async markPaid(id: string, transactionId: string) {
    const r = this.rows.get(id)
    if (!r || r.status !== 'PENDING') return null
    this.rows.set(id, { ...r, status: 'PAID', transactionId })
    return this.rows.get(id)!
  }

  async findByUserIdPaginated(_userId: string, _cursor: { createdAt: Date; id: string } | null, _limit: number) {
    return { items: [], nextCursor: null, hasMore: false }
  }

  async markExpired(id: string) {
    const r = this.rows.get(id)
    if (!r || r.status !== 'PENDING') return null
    this.rows.set(id, { ...r, status: 'EXPIRED' })
    return this.rows.get(id)!
  }
}

class FakeWebhookRepo implements WebhookEventRepository {
  rows = new Map<string, WebhookEvent>()
  seq = 0

  snapshot() { return { rows: new Map(this.rows), seq: this.seq } }
  restore(s: unknown) { const snap = s as { rows: Map<string, WebhookEvent>; seq: number }; this.rows = snap.rows; this.seq = snap.seq }
  async create(input: { provider: WebhookEvent['provider']; providerEventId: string; payloadHash: string }) {
    // Simulate the DB unique (provider, providerEventId) constraint (Prisma P2002).
    for (const r of this.rows.values()) {
      if (r.provider === input.provider && r.providerEventId === input.providerEventId) {
        const err = new Error('Unique constraint failed') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
    }
    const r: WebhookEvent = { id: `evt-${++this.seq}`, provider: input.provider, providerEventId: input.providerEventId, payloadHash: input.payloadHash, payload: null, status: 'RECEIVED', error: null, receivedAt: new Date(), processedAt: null }
    this.rows.set(r.id, r)
    return r
  }
  async findByProviderEventId(provider: WebhookEvent['provider'], providerEventId: string) {
    for (const r of this.rows.values()) if (r.provider === provider && r.providerEventId === providerEventId) return r
    return null
  }
  async markProcessed(id: string) {
    const r = this.rows.get(id)!
    this.rows.set(id, { ...r, status: 'PROCESSED', processedAt: new Date() })
    return this.rows.get(id)!
  }
  async markFailed(id: string, error: string) {
    const r = this.rows.get(id)!
    this.rows.set(id, { ...r, status: 'FAILED', error, processedAt: new Date() })
    return this.rows.get(id)!
  }
}

// ─── Snapshot-capable tx manager (simulates DB rollback on throw) ──────
// In a real DB, an exception inside $transaction rolls back ALL writes.
// This fake snapshots the in-memory repos and restores them on failure.

interface Snapshotable {
  snapshot(): unknown
  restore(s: unknown): void
}

function snapshotable(repo: object): Snapshotable | null {
  return (repo as Snapshotable).snapshot ? (repo as Snapshotable) : null
}

function makeSnapshotTxManager(...repos: object[]) {
  return {
    withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
      const snaps = repos.map((r) => snapshotable(r)?.snapshot())
      return fn({} as TxClient).catch((err) => {
        repos.forEach((r, i) => {
          const s = snapshotable(r)
          if (s && snaps[i] !== undefined) s.restore(snaps[i])
        })
        throw err
      })
    },
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────

let walletRepo: FakeWalletRepo
let txRepo: FakeTxRepo
let topupRepo: FakeTopupRepo
let webhookRepo: FakeWebhookRepo
let dispatcher: EventDispatcher
let events: string[]
let webhookService: WebhookService
let topupService: TopupService
let walletService: WalletService

beforeEach(async () => {
  walletRepo = new FakeWalletRepo()
  txRepo = new FakeTxRepo()
  topupRepo = new FakeTopupRepo()
  webhookRepo = new FakeWebhookRepo()
  dispatcher = new LocalEventDispatcher()
  events = []
  dispatcher.subscribe('topup.completed', (e) => events.push(`completed:${e.metadata.amount}`))
  dispatcher.subscribe('topup.failed', (e) => events.push(`failed:${e.metadata.amount}`))

  walletService = new WalletService(walletRepo, txRepo, makeSnapshotTxManager(walletRepo, txRepo, topupRepo, webhookRepo), dispatcher)
  topupService = new TopupService(topupRepo, walletService, new PaymentService(new MockProvider()), makeSnapshotTxManager(walletRepo, txRepo, topupRepo, webhookRepo))
  webhookService = new WebhookService(
    new PaymentService(new MockProvider()),
    walletService,
    topupService,
    webhookRepo,
    makeSnapshotTxManager(walletRepo, txRepo, topupRepo, webhookRepo),
    dispatcher
  )

  await walletRepo.create('user-1', 'USD')
})

async function createPaidTopup(amount = '50.00', currency = 'USD') {
  const created = await topupService.createTopup({
    userId: 'user-1',
    amount: Money.fromString(amount, currency as 'USD'),
  })
  return created.topup.providerReference!
}

/** Create a topup whose expiry is already in the past (expired). */
async function createExpiredTopup(amount = '50.00') {
  const wallet = await walletRepo.findByUserId('user-1')!
  const topup = await topupRepo.create({
    userId: 'user-1',
    walletId: wallet!.id,
    amount: new Prisma.Decimal(amount),
    currency: 'USD',
    provider: 'MOCK',
    expiresAt: new Date(Date.now() - 1000), // already expired
  })
  const reference = `mock_expired_${topup.id}`
  await topupRepo.updateProviderReference(topup.id, reference)
  return reference
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('WebhookService full payment flow', () => {
  it('credits the wallet exactly once on a valid PAID webhook', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(result.outcome).toBe('processed')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('50')
    expect(txRepo.transactions).toHaveLength(1)
    expect(txRepo.transactions[0].type).toBe('TOPUP')
    expect(events).toEqual(['completed:50.000000'])
  })

  it('replay of the same webhook never credits twice', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const first = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(first.outcome).toBe('processed')

    // Same event redelivered (same eventId → duplicate)
    const second = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(second.outcome).toBe('duplicate')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('50') // still 50, not 100
    expect(txRepo.transactions).toHaveLength(1)
    expect(events).toEqual(['completed:50.000000'])
  })

  it('rejects a webhook with mismatched amount', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '99.00', currency: 'USD', status: 'PAID',
    })

    await expect(webhookService.handlePaymentWebhook(rawBody, signature, headers)).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
  })

  it('rejects a webhook with mismatched currency', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'IDR', status: 'PAID',
    })

    await expect(webhookService.handlePaymentWebhook(rawBody, signature, headers)).rejects.toThrow()
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
  })

  it('rejects a forged webhook (bad signature)', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    await expect(
      webhookService.handlePaymentWebhook(rawBody, 'deadbeef', headers)
    ).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
  })

  it('marks topup FAILED on provider FAILED status without crediting', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'FAILED',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(result.outcome).toBe('processed')

    const topup = await topupRepo.findByProviderReference(providerReference)
    expect(topup!.status).toBe('FAILED')
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
    expect(events).toEqual(['failed:50.000000'])
  })

  it('ignores webhooks for unknown provider references', async () => {
    const provider = new MockProvider()
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference: 'mock_nonexistent', amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(result.outcome).toBe('ignored')
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
  })
})

describe('WebhookService expired payment protection (P1)', () => {
  it('payment before expiresAt → credit succeeds', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00') // expires in ~30min
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(result.outcome).toBe('processed')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('50')
  })

  it('payment after expiresAt → NO credit, topup EXPIRED, acked', async () => {
    const provider = new MockProvider()
    const providerReference = await createExpiredTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    // Ack so the provider stops redelivering.
    expect(result.outcome).toBe('processed')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0') // never credited
    expect(txRepo.transactions).toHaveLength(0) // no credit transaction

    const topup = await topupRepo.findByProviderReference(providerReference)
    expect(topup!.status).toBe('EXPIRED')
  })

  it('replay of an expired webhook → still NO credit', async () => {
    const provider = new MockProvider()
    const providerReference = await createExpiredTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const first = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(first.outcome).toBe('processed')

    // Same event redelivered → duplicate, still no credit.
    const second = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(second.outcome).toBe('duplicate')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('FAILED webhook for an expired topup → EXPIRED preserved, no credit', async () => {
    const provider = new MockProvider()
    const providerReference = await createExpiredTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'FAILED',
    })

    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)
    expect(result.outcome).toBe('processed')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
    // Expired guard runs before FAILED handling: status stays EXPIRED.
    const topup = await topupRepo.findByProviderReference(providerReference)
    expect(topup!.status).toBe('EXPIRED')
  })
})

describe('WebhookService concurrency (race condition)', () => {
  it('two parallel deliveries of the same event credit only once', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '50.00', currency: 'USD', status: 'PAID',
    })

    const results = await Promise.allSettled([
      webhookService.handlePaymentWebhook(rawBody, signature, headers),
      webhookService.handlePaymentWebhook(rawBody, signature, headers),
    ])

    // One delivery wins (processed); the other is a duplicate — never a
    // second credit. With the snapshot tx manager, the losing transaction
    // rolls back entirely (like a real DB).
    const processed = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { outcome: string }).outcome === 'processed'
    ).length
    const duplicates = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { outcome: string }).outcome === 'duplicate'
    ).length

    expect(processed).toBe(1)
    expect(duplicates + results.filter((r) => r.status === 'rejected').length).toBe(1)

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('50')
    expect(txRepo.transactions).toHaveLength(1)
  })
})

describe('Domain events emitted after commit only', () => {
  it('does not emit topup.completed when credit fails', async () => {
    const provider = new MockProvider()
    const providerReference = await createPaidTopup('50.00')
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference, amount: '99.00', currency: 'USD', status: 'PAID',
    })

    await expect(webhookService.handlePaymentWebhook(rawBody, signature, headers)).rejects.toThrow()
    expect(events).toHaveLength(0)
  })
})

// Silence unused import warning for createDomainEvent in this test file.
void createDomainEvent
