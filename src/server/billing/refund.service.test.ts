// ProxyAI — RefundService Unit & Integration Tests
// Billing Milestone 6 — Refund Service
//
// In-memory fakes with a rollback-capable, serialized transaction manager.
// Composes the REAL WalletService + IdempotencyService; only persistence
// is faked. No database.

import { describe, it, expect, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, UsageLog, IdempotencyKey, RefundRequest } from '@prisma/client'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import { WalletService } from '@/server/wallet/wallet.service'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'
import { IdempotencyService, IdempotencyErrorCode } from '@/server/idempotency/idempotency.service'
import type { IdempotencyKeyRepository, IdempotencyKeyCreateInput } from '@/server/idempotency/idempotency-key.repository'
import type { UsageRepository, UsageLogCreateInput } from '@/server/usage/usage.repository'
import type { RefundRepository, RefundRequestCreateInput } from '@/server/refund/refund.repository'
import { RefundService, RefundErrorCode } from '@/server/billing/refund.service'

// ─── Clone helpers ──────────────────────────────────────────────────────

const dec = (d: Prisma.Decimal) => new Prisma.Decimal(d.toString())

interface Snapshottable {
  snapshot(): unknown
  restore(snap: unknown): void
}

const cloneWallet = (w: Wallet): Wallet => ({
  ...w,
  balance: dec(w.balance),
  createdAt: new Date(w.createdAt),
  updatedAt: new Date(w.updatedAt),
})

const cloneTx = (t: Transaction): Transaction => ({
  ...t,
  amount: dec(t.amount),
  balanceBefore: dec(t.balanceBefore),
  balanceAfter: dec(t.balanceAfter),
  createdAt: new Date(t.createdAt),
})

const cloneUsage = (u: UsageLog): UsageLog => ({
  ...u,
  providerCost: dec(u.providerCost),
  userCost: dec(u.userCost),
  inputPrice: u.inputPrice ? dec(u.inputPrice) : null,
  outputPrice: u.outputPrice ? dec(u.outputPrice) : null,
  markupPercent: u.markupPercent ? dec(u.markupPercent) : null,
  serviceFee: u.serviceFee ? dec(u.serviceFee) : null,
  createdAt: new Date(u.createdAt),
})

const cloneIdem = (k: IdempotencyKey): IdempotencyKey => ({
  ...k,
  response: k.response === null ? null : JSON.parse(JSON.stringify(k.response)),
  createdAt: new Date(k.createdAt),
  updatedAt: new Date(k.updatedAt),
})

const cloneRefund = (r: RefundRequest): RefundRequest => ({
  ...r,
  amount: dec(r.amount),
  createdAt: new Date(r.createdAt),
  updatedAt: new Date(r.updatedAt),
})

// ─── Fakes ──────────────────────────────────────────────────────────────

class FakeWalletRepository implements WalletRepository, Snapshottable {
  wallets = new Map<string, Wallet>()

  snapshot() {
    return new Map([...this.wallets].map(([id, w]) => [id, cloneWallet(w)]))
  }

  restore(snap: unknown) {
    this.wallets = snap as Map<string, Wallet>
  }

  seed(userId: string, balance: string, status: Wallet['status'] = 'ACTIVE', currency: Wallet['currency'] = 'USD') {
    const wallet: Wallet = {
      id: `wallet-${userId}`,
      userId,
      balance: new Prisma.Decimal(balance),
      currency,
      status,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.wallets.set(wallet.id, wallet)
    return wallet
  }

  async findById(id: string) {
    return this.wallets.get(id) ?? null
  }

  async findByUserId(userId: string) {
    for (const w of this.wallets.values()) if (w.userId === userId) return w
    return null
  }

  async findByUserIdAndStatus(userId: string, status: Wallet['status']) {
    const w = await this.findByUserId(userId)
    return w && w.status === status ? w : null
  }

  async create(userId: string, currency: Wallet['currency']) {
    return this.seed(userId, '0', 'ACTIVE', currency)
  }

  async credit(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    w.balance = w.balance.plus(amount)
    w.version += 1
    return w
  }

  async debitIfSufficient(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.lessThan(amount)) return null
    w.balance = w.balance.minus(amount)
    w.version += 1
    return w
  }

  async debitWithFloor(id: string, amount: Prisma.Decimal, floor: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.plus(floor).lessThan(amount)) return null
    w.balance = w.balance.minus(amount)
    w.version += 1
    return w
  }

  async updateStatus(id: string, status: Wallet['status']) {
    const w = this.wallets.get(id)!
    w.status = status
    return w
  }
}

class FakeTransactionRepository implements TransactionRepository, Snapshottable {
  transactions: Transaction[] = []
  private seq = 0

  snapshot() {
    return this.transactions.map(cloneTx)
  }

  restore(snap: unknown) {
    this.transactions = snap as Transaction[]
  }

  async create(input: TransactionCreateInput) {
    if (this.transactions.some((t) => t.reference === input.reference)) {
      const err = new Error('Unique constraint: reference already exists') as Error & { code?: string }
      err.code = 'P2002'
      throw err
    }
    const tx: Transaction = {
      id: `txn-${++this.seq}`,
      walletId: input.walletId,
      userId: input.userId,
      amount: input.amount,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      currency: input.currency,
      type: input.type,
      reference: input.reference,
      status: input.status ?? 'COMPLETED',
      description: input.description ?? null,
      requestId: input.requestId ?? null,
      providerReference: input.providerReference ?? null,
      createdBy: input.createdBy ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
    }
    this.transactions.push(tx)
    return tx
  }

  async findByReference(reference: string) {
    return this.transactions.find((t) => t.reference === reference) ?? null
  }

  async findByWalletIdPaginated(walletId: string) {
    const items = this.transactions
      .filter((t) => t.walletId === walletId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { items, nextCursor: null, hasMore: false }
  }
}

class FakeUsageRepository implements UsageRepository, Snapshottable {
  logs: UsageLog[] = []
  failMarkRefunded = false
  private seq = 0

  snapshot() {
    return this.logs.map(cloneUsage)
  }

  restore(snap: unknown) {
    this.logs = snap as UsageLog[]
  }

  seedUsage(overrides: Partial<UsageLog> = {}) {
    const log: UsageLog = {
      id: `usage-${++this.seq}`,
      userId: 'user-1',
      apiKeyId: null,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      modelId: 'model-1',
      pricingVersionId: 'pv-model-1-1',
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 0,
      totalTokens: 1500,
      providerCost: new Prisma.Decimal('0.00045'),
      userCost: new Prisma.Decimal('0.000496'),
      currency: 'USD',
      latencyMs: null,
      status: 'COMPLETED',
      requestId: 'req-1',
      inputPrice: new Prisma.Decimal('0.15'),
      outputPrice: new Prisma.Decimal('0.6'),
      markupPercent: new Prisma.Decimal('10'),
      serviceFee: new Prisma.Decimal('0.000001'),
      createdAt: new Date(),
      ...overrides,
    }
    this.logs.push(log)
    return log
  }

  async create(input: UsageLogCreateInput) {
    const log: UsageLog = {
      id: `usage-${++this.seq}`,
      userId: input.userId,
      apiKeyId: input.apiKeyId ?? null,
      provider: input.provider,
      model: input.model,
      modelId: input.modelId ?? null,
      pricingVersionId: input.pricingVersionId ?? null,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      cachedTokens: input.cachedTokens ?? 0,
      totalTokens: input.totalTokens,
      providerCost: input.providerCost,
      userCost: input.userCost,
      currency: input.currency,
      latencyMs: input.latencyMs ?? null,
      status: input.status ?? 'PENDING',
      requestId: input.requestId ?? null,
      inputPrice: input.inputPrice ?? null,
      outputPrice: input.outputPrice ?? null,
      markupPercent: input.markupPercent ?? null,
      serviceFee: input.serviceFee ?? null,
      createdAt: new Date(),
    }
    this.logs.push(log)
    return log
  }

  async findById(id: string) {
    return this.logs.find((l) => l.id === id) ?? null
  }

  async findByRequestId(requestId: string) {
    return this.logs.find((l) => l.requestId === requestId) ?? null
  }

  async findByUserIdPaginated(userId: string) {
    const items = this.logs
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { items, nextCursor: null, hasMore: false }
  }

  async updateStatus(id: string, status: UsageLog['status']) {
    const log = this.logs.find((l) => l.id === id)!
    log.status = status
    return log
  }

  async aggregatePeriod(userId: string, _from: Date, _to: Date) {
    const logs = this.logs.filter((l) => l.userId === userId && l.status === 'COMPLETED')
    return {
      requests: logs.length,
      tokens: logs.reduce((sum, l) => sum + l.totalTokens, 0),
      cost: logs.reduce((sum, l) => sum.plus(l.userCost), new Prisma.Decimal(0)),
    }
  }
  async markRefunded(id: string) {
    if (this.failMarkRefunded) throw new Error('DB failure: markRefunded failed')
    const log = this.logs.find((l) => l.id === id)
    if (!log || log.status !== 'COMPLETED') return null
    log.status = 'REFUNDED'
    return log
  }
}

class FakeIdempotencyRepository implements IdempotencyKeyRepository, Snapshottable {
  keys: IdempotencyKey[] = []
  private seq = 0

  snapshot() {
    return this.keys.map(cloneIdem)
  }

  restore(snap: unknown) {
    this.keys = snap as IdempotencyKey[]
  }

  async findActive(key: string, scope: string, userId: string, now: Date) {
    return (
      this.keys.find(
        (k) => k.key === key && k.scope === scope && k.userId === userId && k.expiresAt > now
      ) ?? null
    )
  }

  async create(input: IdempotencyKeyCreateInput) {
    if (this.keys.some((k) => k.key === input.key && k.scope === input.scope && k.userId === input.userId)) {
      const err = new Error('Unique constraint: idempotency key exists') as Error & { code?: string }
      err.code = 'P2002'
      throw err
    }
    const key: IdempotencyKey = {
      id: `idem-${++this.seq}`,
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
    this.keys.push(key)
    return key
  }

  async complete(id: string, response: Prisma.InputJsonValue) {
    const key = this.keys.find((k) => k.id === id)!
    key.status = 'COMPLETED'
    key.response = response as Prisma.JsonValue
    return key
  }

  async deleteExpired(now: Date) {
    const before = this.keys.length
    this.keys = this.keys.filter((k) => k.expiresAt > now)
    return before - this.keys.length
  }
}

class FakeRefundRepository implements RefundRepository, Snapshottable {
  refunds: RefundRequest[] = []
  private seq = 0

  snapshot() {
    return this.refunds.map(cloneRefund)
  }

  restore(snap: unknown) {
    this.refunds = snap as RefundRequest[]
  }

  seed(overrides: Partial<RefundRequest> = {}) {
    const refund: RefundRequest = {
      id: `refund-${++this.seq}`,
      userId: 'user-1',
      usageLogId: 'usage-1',
      amount: new Prisma.Decimal('0.000496'),
      currency: 'USD',
      status: 'REQUESTED',
      version: 1,
      reason: null,
      requestedBy: 'system',
      approvedBy: null,
      rejectedBy: null,
      rejectionReason: null,
      transactionId: null,
      requestId: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
    this.refunds.push(refund)
    return refund
  }

  async create(input: RefundRequestCreateInput) {
    if (this.refunds.some((r) => r.usageLogId === input.usageLogId)) {
      const err = new Error('Unique constraint: usageLogId already refunded') as Error & { code?: string }
      err.code = 'P2002'
      throw err
    }
    const refund: RefundRequest = {
      id: `refund-${++this.seq}`,
      userId: input.userId,
      usageLogId: input.usageLogId,
      amount: input.amount,
      currency: input.currency,
      status: 'REQUESTED',
      version: 1,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy,
      approvedBy: null,
      rejectedBy: null,
      rejectionReason: null,
      transactionId: null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.refunds.push(refund)
    return refund
  }

  async findById(id: string) {
    return this.refunds.find((r) => r.id === id) ?? null
  }

  async findByUsageLogId(usageLogId: string) {
    return this.refunds.find((r) => r.usageLogId === usageLogId) ?? null
  }

  async findByUserIdPaginated(userId: string) {
    const items = this.refunds
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { items, nextCursor: null, hasMore: false }
  }

  async updateStatus(id: string, status: RefundRequest['status'], expectedVersion: number) {
    const refund = this.refunds.find((r) => r.id === id)
    if (!refund || refund.version !== expectedVersion) return null
    refund.status = status
    refund.version += 1
    return refund
  }

  async markCompleted(id: string, transactionId: string, expectedVersion: number, _tx?: unknown, approvedBy?: string) {
    const refund = this.refunds.find((r) => r.id === id)
    if (!refund || refund.version !== expectedVersion) return null
    if (refund.status !== 'REQUESTED' && refund.status !== 'APPROVED') return null
    refund.status = 'COMPLETED'
    refund.transactionId = transactionId
    refund.approvedBy = approvedBy ?? null
    refund.version += 1
    return refund
  }
}

/** Rollback-capable, serialized transaction manager (fakes share state). */
class FakeTransactionManager implements TransactionManager {
  private tail: Promise<unknown> = Promise.resolve()

  constructor(private readonly fakes: Snapshottable[]) {}

  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const snaps = this.fakes.map((f) => f.snapshot())
      try {
        return await fn({} as TxClient)
      } catch (error) {
        this.fakes.forEach((f, i) => f.restore(snaps[i]))
        throw error
      }
    }
    const result = this.tail.then(run, run)
    this.tail = result.catch(() => undefined)
    return result
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────

let walletRepo: FakeWalletRepository
let txRepo: FakeTransactionRepository
let usageRepo: FakeUsageRepository
let idemRepo: FakeIdempotencyRepository
let refundRepo: FakeRefundRepository
let txManager: FakeTransactionManager
let dispatcher: EventDispatcher
let walletService: WalletService
let idemService: IdempotencyService
let service: RefundService
let events: string[]

const REFUND_AMOUNT = '0.000496'

function buildRefundInput(overrides: Partial<Parameters<RefundService['refund']>[0]> = {}) {
  return {
    usageLogId: 'usage-1',
    userId: 'user-1',
    reason: 'duplicate request',
    idempotencyKey: 'key-1',
    requestId: 'req-refund-1',
    ...overrides,
  }
}

beforeEach(() => {
  walletRepo = new FakeWalletRepository()
  txRepo = new FakeTransactionRepository()
  usageRepo = new FakeUsageRepository()
  idemRepo = new FakeIdempotencyRepository()
  refundRepo = new FakeRefundRepository()
  txManager = new FakeTransactionManager([walletRepo, txRepo, usageRepo, idemRepo, refundRepo])
  dispatcher = new LocalEventDispatcher()
  events = []
  dispatcher.subscribe('billing.refunded', (e) => events.push(`refunded:${e.metadata.amount}`))
  dispatcher.subscribe('wallet.credited', (e) => events.push(`credited:${e.metadata.amount}`))

  walletService = new WalletService(walletRepo, txRepo, txManager, dispatcher)
  idemService = new IdempotencyService(idemRepo)
  service = new RefundService(
    refundRepo,
    usageRepo,
    walletService,
    idemService,
    txManager,
    dispatcher
  )

  walletRepo.seed('user-1', '10.00')
  usageRepo.seedUsage()
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('RefundService — normal refund', () => {
  it('credits the wallet, creates a REFUND transaction and completes the refund in one tx', async () => {
    const result = await service.refund(buildRefundInput())

    expect(result.replayed).toBe(false)
    expect(result.amount).toBe(REFUND_AMOUNT)
    expect(result.currency).toBe('USD')
    expect(result.refundStatus).toBe('COMPLETED')
    expect(result.usageStatus).toBe('REFUNDED')
    expect(result.walletBalanceAfter).toBe('10.000496')
    expect(result.refundRequestId).toMatch(/^refund-/)
    expect(result.transactionId).toMatch(/^txn-/)

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10.000496')

    expect(txRepo.transactions).toHaveLength(1)
    expect(txRepo.transactions[0]!.type).toBe('REFUND')
    expect(txRepo.transactions[0]!.reference).toBe('refund_req-refund-1')
    expect(txRepo.transactions[0]!.balanceBefore.toString()).toBe('10')
    expect(txRepo.transactions[0]!.balanceAfter.toString()).toBe('10.000496')
    expect(txRepo.transactions[0]!.providerReference).toBe('usage-1')

    const usage = usageRepo.logs[0]!
    expect(usage.status).toBe('REFUNDED')

    const refund = refundRepo.refunds[0]!
    expect(refund.status).toBe('COMPLETED')
    expect(refund.approvedBy).toBe('system')
    expect(refund.version).toBe(2) // optimistic locking: 1 → 2
  })

  it('emits billing.refunded + wallet.credited AFTER commit', async () => {
    await service.refund(buildRefundInput())
    expect(events).toEqual([`refunded:${REFUND_AMOUNT}`, `credited:${REFUND_AMOUNT}`])
  })

  it('reactivates a PAYMENT_REQUIRED wallet when the refund clears the debt', async () => {
    walletRepo.seed('user-2', '-0.05', 'PAYMENT_REQUIRED')
    usageRepo.seedUsage({ id: 'usage-2', userId: 'user-2', userCost: new Prisma.Decimal('0.10') })

    const result = await service.refund(
      buildRefundInput({ usageLogId: 'usage-2', userId: 'user-2', idempotencyKey: 'key-2', requestId: 'req-2' })
    )

    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('0.05')
    expect(wallet!.status).toBe('ACTIVE')
    expect(result.walletBalanceAfter).toBe('0.050000') // Money serializes 6dp
  })
})

describe('RefundService — duplicate refund', () => {
  it('rejects a second refund of the same usage log', async () => {
    await service.refund(buildRefundInput())
    await expect(
      service.refund(buildRefundInput({ idempotencyKey: 'key-2', requestId: 'req-2' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.ALREADY_REFUNDED })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10.000496') // credited once
    expect(txRepo.transactions).toHaveLength(1)
    expect(refundRepo.refunds).toHaveLength(1)
  })

  it('rejects when a refund request already exists (even if the usage is still COMPLETED)', async () => {
    refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1' }) // pre-existing REQUESTED refund

    await expect(service.refund(buildRefundInput())).rejects.toMatchObject({
      code: RefundErrorCode.ALREADY_REFUNDED,
    })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10') // nothing credited
    expect(usageRepo.logs[0]!.status).toBe('COMPLETED')
    expect(events).toHaveLength(0)
  })
})

describe('RefundService — idempotency', () => {
  it('replays the stored result for an identical retry (no double credit)', async () => {
    const first = await service.refund(buildRefundInput())
    const second = await service.refund(buildRefundInput())

    expect(second.replayed).toBe(true)
    expect(second.refundRequestId).toBe(first.refundRequestId)
    expect(second.transactionId).toBe(first.transactionId)
    expect({ ...first, replayed: undefined }).toEqual({ ...second, replayed: undefined })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10.000496') // credited exactly once
    expect(txRepo.transactions).toHaveLength(1)
    expect(refundRepo.refunds).toHaveLength(1)
    expect(events).toHaveLength(2) // events only from the first refund
  })

  it('rejects the same key with a different payload', async () => {
    await service.refund(buildRefundInput())
    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-9' }))
    ).rejects.toMatchObject({ code: IdempotencyErrorCode.KEY_REUSED_WITH_DIFFERENT_REQUEST })
  })
})

describe('RefundService — failure & rollback', () => {
  it('throws USAGE_NOT_FOUND for an unknown usage log', async () => {
    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-missing' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.USAGE_NOT_FOUND })
    expect(events).toHaveLength(0)
  })

  it('rejects usage that is not COMPLETED (PENDING / FAILED)', async () => {
    usageRepo.seedUsage({ id: 'usage-pending', status: 'PENDING' })
    usageRepo.seedUsage({ id: 'usage-failed', status: 'FAILED' })

    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-pending', idempotencyKey: 'kp' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.USAGE_NOT_ELIGIBLE })
    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-failed', idempotencyKey: 'kf' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.USAGE_NOT_ELIGIBLE })
  })

  it('rejects refunding another user\'s usage log', async () => {
    await expect(
      service.refund(buildRefundInput({ userId: 'user-2' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.USER_MISMATCH })
  })

  it('throws WALLET_NOT_FOUND for a user without a wallet', async () => {
    usageRepo.seedUsage({ id: 'usage-ghost', userId: 'ghost' })
    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-ghost', userId: 'ghost' }))
    ).rejects.toMatchObject({ code: RefundErrorCode.WALLET_NOT_FOUND })
  })

  it('rolls back everything when markRefunded fails', async () => {
    usageRepo.failMarkRefunded = true
    await expect(service.refund(buildRefundInput())).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10') // credit rolled back
    expect(txRepo.transactions).toHaveLength(0)
    expect(refundRepo.refunds).toHaveLength(0) // refund request rolled back
    expect(idemRepo.keys).toHaveLength(0) // reservation rolled back too
    expect(usageRepo.logs[0]!.status).toBe('COMPLETED')
    expect(events).toHaveLength(0)
  })

  it('rolls back when the wallet credit is rejected (suspended wallet)', async () => {
    walletRepo.seed('user-2', '5.00', 'SUSPENDED')
    usageRepo.seedUsage({ id: 'usage-2', userId: 'user-2' })

    await expect(
      service.refund(buildRefundInput({ usageLogId: 'usage-2', userId: 'user-2' }))
    ).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('5') // unchanged
    expect(refundRepo.refunds).toHaveLength(0)
    expect(usageRepo.logs.find((l) => l.id === 'usage-2')!.status).toBe('COMPLETED')
    expect(events).toHaveLength(0)
  })

  it('never emits events on failure', async () => {
    usageRepo.failMarkRefunded = true
    await expect(service.refund(buildRefundInput())).rejects.toThrow()
    expect(events).toHaveLength(0)
  })
})

describe('RefundService — optimistic locking', () => {
  it('markCompleted is guarded by the expected version (stale write → null)', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-x' })
    expect(refund.version).toBe(1)

    // Correct version wins.
    const ok = await refundRepo.markCompleted(refund.id, 'txn-1', 1)
    expect(ok).not.toBeNull()
    expect(ok!.status).toBe('COMPLETED')
    expect(ok!.version).toBe(2)

    // Stale version loses.
    const stale = await refundRepo.markCompleted(refund.id, 'txn-2', 1)
    expect(stale).toBeNull()

    // Already completed: guarded by status too.
    const again = await refundRepo.markCompleted(refund.id, 'txn-3', 2)
    expect(again).toBeNull()
  })

  it('the refund request version advances through the service flow', async () => {
    await service.refund(buildRefundInput())
    expect(refundRepo.refunds[0]!.version).toBe(2)
  })
})

describe('RefundService — concurrency', () => {
  it('race: two parallel refunds with the same key credit the wallet exactly once', async () => {
    const outcomes = await Promise.allSettled([
      service.refund(buildRefundInput()),
      service.refund(buildRefundInput()),
    ])

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
    const applied = fulfilled.filter((o) => o.status === 'fulfilled' && !o.value.replayed)
    expect(applied).toHaveLength(1)

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10.000496') // credited exactly once
    expect(txRepo.transactions).toHaveLength(1)
    expect(refundRepo.refunds).toHaveLength(1)
    expect(events).toHaveLength(2)
  })

  it('rejects a concurrent in-flight duplicate (IN_PROGRESS)', async () => {
    await idemService.reserve({
      key: 'key-1',
      scope: 'wallet:refund',
      userId: 'user-1',
      request: {
        usageLogId: 'usage-1',
        userId: 'user-1',
        reason: 'duplicate request',
        requestId: 'req-refund-1',
      },
    })

    await expect(service.refund(buildRefundInput())).rejects.toMatchObject({
      code: IdempotencyErrorCode.IN_PROGRESS,
    })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10') // nothing credited
    expect(refundRepo.refunds).toHaveLength(0)
    expect(events).toHaveLength(0)
  })
})

describe('RefundService — deterministic result', () => {
  it('identical refunds produce identical results across users', async () => {
    walletRepo.seed('user-2', '10.00')
    usageRepo.seedUsage({ id: 'usage-2', userId: 'user-2' })

    const a = await service.refund(buildRefundInput({ idempotencyKey: 'ka' }))
    const b = await service.refund(
      buildRefundInput({ usageLogId: 'usage-2', userId: 'user-2', idempotencyKey: 'kb', requestId: 'req-2' })
    )

    expect(a.amount).toBe(b.amount)
    expect(a.walletBalanceAfter).toBe(b.walletBalanceAfter)
    expect(a.refundStatus).toBe(b.refundStatus)
    expect(a.usageStatus).toBe(b.usageStatus)
    expect(a.refundRequestId).not.toBe(b.refundRequestId)
  })
})

// ─── Admin approval path (M5 hardening) ─────────────────────────────────

describe('RefundService — adminApprove', () => {
  it('completes an EXISTING request atomically: credit + usage REFUNDED + request COMPLETED', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1' })

    const result = await service.adminApprove({
      refundRequestId: refund.id,
      adminId: 'admin-1',
      requestId: 'req-admin-1',
    })

    expect(result.replayed).toBe(false)
    expect(result.refundRequestId).toBe(refund.id)
    expect(result.amount).toBe(REFUND_AMOUNT)
    expect(result.refundStatus).toBe('COMPLETED')
    expect(result.usageStatus).toBe('REFUNDED')
    expect(result.walletBalanceAfter).toBe('10.000496')

    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toString()).toBe('10.000496')

    // No NEW refund request row — the existing one was completed.
    expect(refundRepo.refunds).toHaveLength(1)
    expect(refundRepo.refunds[0]!.status).toBe('COMPLETED')
    expect(refundRepo.refunds[0]!.approvedBy).toBe('admin:admin-1')
    expect(refundRepo.refunds[0]!.version).toBe(2)

    expect(txRepo.transactions).toHaveLength(1)
    expect(txRepo.transactions[0]!.type).toBe('REFUND')
    expect(txRepo.transactions[0]!.reference).toBe(`refund_admin_${refund.id}`)
    expect(events).toEqual([`refunded:${REFUND_AMOUNT}`, `credited:${REFUND_AMOUNT}`])
  })

  it('is idempotent: a retry replays the stored result without a second credit', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1' })

    const first = await service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' })
    const second = await service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' })

    expect(second.replayed).toBe(true)
    expect(second.transactionId).toBe(first.transactionId)
    expect(second.walletBalanceAfter).toBe(first.walletBalanceAfter)
    // Wallet credited exactly once.
    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toString()).toBe('10.000496')
    expect(txRepo.transactions).toHaveLength(1)
    // Events emitted once (only the first call).
    expect(events).toHaveLength(2)
  })

  it('recovers a request stuck in APPROVED by the legacy two-step flow', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1', status: 'APPROVED' })

    const result = await service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' })

    expect(result.refundStatus).toBe('COMPLETED')
    expect(refundRepo.refunds[0]!.status).toBe('COMPLETED')
  })

  it('rejects requests in a terminal status', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1', status: 'COMPLETED', version: 2 })

    await expect(
      service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' })
    ).rejects.toMatchObject({ code: 'REFUND_FAILED' })

    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toString()).toBe('10')
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('rolls back everything when the usage cannot be marked REFUNDED', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1' })
    usageRepo.failMarkRefunded = true

    await expect(
      service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' })
    ).rejects.toMatchObject({ code: 'REFUND_FAILED' })

    // Full rollback: no credit, request still REQUESTED, no events.
    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toString()).toBe('10')
    expect(refundRepo.refunds[0]!.status).toBe('REQUESTED')
    expect(txRepo.transactions).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('serializes concurrent approvals — exactly one credit', async () => {
    const refund = refundRepo.seed({ usageLogId: 'usage-1', userId: 'user-1' })

    const [a, b] = await Promise.all([
      service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' }),
      service.adminApprove({ refundRequestId: refund.id, adminId: 'admin-1' }),
    ])

    // Either one processed and the other replayed, or one threw IN_PROGRESS.
    const succeeded = [a, b].filter((r) => r.replayed === false)
    const replayed = [a, b].filter((r) => r.replayed === true)
    expect(succeeded.length + replayed.length).toBeGreaterThanOrEqual(1)

    const wallet = await walletRepo.findByUserId('user-1')
    expect(wallet!.balance.toString()).toBe('10.000496')
    expect(txRepo.transactions.filter((t) => t.type === 'REFUND')).toHaveLength(1)
  })
})

