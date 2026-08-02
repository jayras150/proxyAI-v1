// ProxyAI — ChargeService Unit & Integration Tests
// Billing Milestone 5 — Charge Service
//
// Uses in-memory fakes with a rollback-capable transaction manager (no DB).
// Composes the REAL PricingEngine, PricingSnapshot, TokenUsage, UsageMeter
// and IdempotencyService — only persistence is faked.

import { describe, it, expect, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, UsageLog, IdempotencyKey, PricingVersion } from '@prisma/client'
import { Money } from '@/lib/money'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import { WalletService } from '@/server/wallet/wallet.service'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'
import { IdempotencyService, IdempotencyErrorCode } from '@/server/idempotency/idempotency.service'
import type { IdempotencyKeyRepository, IdempotencyKeyCreateInput } from '@/server/idempotency/idempotency-key.repository'
import { PricingEngine } from '@/server/billing/pricing-engine'
import { PricingSnapshot } from '@/server/billing/pricing-snapshot'
import { TokenUsage } from '@/server/billing/token-usage'
import { createUsageMeter } from '@/server/billing/usage-meter'
import { ChargeService, ChargeErrorCode } from '@/server/billing/charge.service'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import type { UsageRepository, UsageLogCreateInput } from '@/server/usage/usage.repository'

// ─── Clone helpers (Decimal/Date round-trip) ────────────────────────────

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

class FakePricingRepo implements PricingRepository, Snapshottable {
  versions: PricingVersion[] = []

  snapshot() {
    return this.versions.map((v) => ({
      ...v,
      inputPrice: dec(v.inputPrice),
      outputPrice: dec(v.outputPrice),
      markupPercent: dec(v.markupPercent),
      serviceFee: dec(v.serviceFee),
      effectiveFrom: new Date(v.effectiveFrom),
      effectiveTo: v.effectiveTo ? new Date(v.effectiveTo) : null,
      createdAt: new Date(v.createdAt),
      updatedAt: new Date(v.updatedAt),
    }))
  }

  restore(snap: unknown) {
    this.versions = snap as PricingVersion[]
  }

  addVersion(modelId: string, overrides: Partial<PricingVersion> = {}) {
    const v: PricingVersion = {
      id: `pv-${modelId}-1`,
      modelId,
      version: 1,
      inputPrice: new Prisma.Decimal('0.15'),
      outputPrice: new Prisma.Decimal('0.60'),
      markupPercent: new Prisma.Decimal('10'),
      serviceFee: new Prisma.Decimal('0.000001'),
      currency: 'USD',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
    this.versions.push(v)
    return v
  }

  async findActiveByModelId(modelId: string, at: Date) {
    return (
      this.versions.find(
        (v) =>
          v.modelId === modelId &&
          v.status === 'ACTIVE' &&
          v.effectiveFrom <= at &&
          (!v.effectiveTo || v.effectiveTo >= at)
      ) ?? null
    )
  }

  async findById(id: string) {
    return this.versions.find((v) => v.id === id) ?? null
  }

  async findByModelId(modelId: string) {
    return this.versions.filter((v) => v.modelId === modelId)
  }

  async create(input: Parameters<PricingRepository['create']>[0]) {
    const v: PricingVersion = {
      id: `pv-${input.modelId}-${input.version}`,
      modelId: input.modelId,
      version: input.version,
      inputPrice: input.inputPrice,
      outputPrice: input.outputPrice,
      markupPercent: input.markupPercent,
      serviceFee: input.serviceFee,
      currency: 'USD',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.versions.push(v)
    return v
  }

  async archive(id: string, effectiveTo: Date) {
    const v = this.versions.find((x) => x.id === id)!
    v.status = 'ARCHIVED'
    v.effectiveTo = effectiveTo
    return v
  }
}

class FakeUsageRepository implements UsageRepository, Snapshottable {
  logs: UsageLog[] = []
  failCreate = false
  private seq = 0

  snapshot() {
    return this.logs.map(cloneUsage)
  }

  restore(snap: unknown) {
    this.logs = snap as UsageLog[]
  }

  async create(input: UsageLogCreateInput) {
    if (this.failCreate) {
      throw new Error('DB failure: usage log insert failed')
    }
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
        (k) =>
          k.key === key &&
          k.scope === scope &&
          k.userId === userId &&
          k.expiresAt > now
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

/**
 * Rollback-capable transaction manager: restores every fake on failure.
 * Transactions are serialized (one at a time) because the fakes share
 * in-memory state — this emulates a real DB where a concurrent duplicate
 * sees either the committed result (replay) or the in-flight reservation
 * (IN_PROGRESS), never a half-applied settlement.
 */
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
let pricingRepo: FakePricingRepo
let usageRepo: FakeUsageRepository
let idemRepo: FakeIdempotencyRepository
let txManager: FakeTransactionManager
let dispatcher: EventDispatcher
let walletService: WalletService
let idemService: IdempotencyService
let service: ChargeService
let events: string[]

const bigUsage = () => TokenUsage.create({ promptTokens: 10_000_000, completionTokens: 10_000_000 })
// cost for bigUsage: input 1.5 + output 6.0 = 7.5 → markup 0.75 → subtotal 8.25 → +0.000001 fee
const BIG_CHARGE = '8.250001'

function buildChargeInput(overrides: Partial<Parameters<ChargeService['charge']>[0]> = {}) {
  return {
    requestId: 'req-1',
    userId: 'user-1',
    modelId: 'model-1',
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
    pricingVersionId: 'pv-model-1-1',
    usage: bigUsage(),
    idempotencyKey: 'key-1',
    ...overrides,
  }
}

beforeEach(() => {
  walletRepo = new FakeWalletRepository()
  txRepo = new FakeTransactionRepository()
  pricingRepo = new FakePricingRepo()
  usageRepo = new FakeUsageRepository()
  idemRepo = new FakeIdempotencyRepository()
  txManager = new FakeTransactionManager([walletRepo, txRepo, usageRepo, idemRepo, pricingRepo])
  dispatcher = new LocalEventDispatcher()
  events = []
  dispatcher.subscribe('billing.charged', (e) =>
    events.push(`charged:${e.metadata.amount}:${e.metadata.walletStatusAfter}`)
  )
  dispatcher.subscribe('wallet.debited', (e) => events.push(`debited:${e.metadata.amount}`))

  walletService = new WalletService(walletRepo, txRepo, txManager, dispatcher)
  idemService = new IdempotencyService(idemRepo)
  service = new ChargeService(
    pricingRepo,
    usageRepo,
    walletService,
    idemService,
    txManager,
    new PricingEngine(),
    dispatcher,
    createUsageMeter()
  )

  pricingRepo.addVersion('model-1')
  walletRepo.seed('user-1', '10.00')
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ChargeService — normal charge', () => {
  it('debits the wallet, creates an AI_USAGE transaction and a UsageLog in one tx', async () => {
    const result = await service.charge(buildChargeInput())

    expect(result.replayed).toBe(false)
    expect(result.breakdown.totalCost).toBe(BIG_CHARGE)
    expect(result.walletBalanceAfter).toBe('1.749999')
    expect(result.walletStatus).toBe('ACTIVE')
    expect(result.chargeId).toMatch(/^usage-/)
    expect(result.transactionId).toMatch(/^txn-/)
    expect(result.usage).toEqual({
      promptTokens: 10_000_000,
      completionTokens: 10_000_000,
      cachedTokens: 0,
      totalTokens: 20_000_000,
    })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('1.749999')

    expect(txRepo.transactions).toHaveLength(1)
    expect(txRepo.transactions[0]!.type).toBe('AI_USAGE')
    expect(txRepo.transactions[0]!.reference).toBe('charge_req-1')
    expect(txRepo.transactions[0]!.balanceBefore.toString()).toBe('10')
    expect(txRepo.transactions[0]!.balanceAfter.toString()).toBe('1.749999')
    expect(txRepo.transactions[0]!.requestId).toBe('req-1')
    expect(txRepo.transactions[0]!.createdBy).toBe('system')

    expect(usageRepo.logs).toHaveLength(1)
    const log = usageRepo.logs[0]!
    expect(log.status).toBe('COMPLETED')
    expect(log.pricingVersionId).toBe('pv-model-1-1')
    expect(log.providerCost.toString()).toBe('7.5')
    expect(log.userCost.toString()).toBe(BIG_CHARGE)
    expect(log.inputPrice!.toString()).toBe('0.15')
    expect(log.outputPrice!.toString()).toBe('0.6')
    expect(log.markupPercent!.toString()).toBe('10')
    expect(log.currency).toBe('USD')
  })

  it('emits billing.charged + wallet.debited AFTER commit', async () => {
    await service.charge(buildChargeInput())
    expect(events).toEqual([`charged:${BIG_CHARGE}:ACTIVE`, `debited:${BIG_CHARGE}`])
  })

  it('uses PricingEngine (pure) — cost math is exact', async () => {
    // Sanity: the charge equals what PricingEngine computes standalone.
    const snapshot = PricingSnapshot.create({
      pricingVersionId: 'pv-model-1-1',
      inputPrice: Money.fromString('0.15', 'USD'),
      outputPrice: Money.fromString('0.60', 'USD'),
      markupPercent: 10,
      serviceFee: Money.fromString('0.000001', 'USD'),
    })
    const breakdown = new PricingEngine().calculate({ snapshot, usage: bigUsage() })
    expect(breakdown.totalCost.toString()).toBe(BIG_CHARGE)
  })
})

describe('ChargeService — idempotency', () => {
  it('replays the stored result for an identical retry (no double debit)', async () => {
    const first = await service.charge(buildChargeInput())
    const second = await service.charge(buildChargeInput())

    expect(second.replayed).toBe(true)
    expect(second.chargeId).toBe(first.chargeId)
    expect(second.transactionId).toBe(first.transactionId)
    expect(second.walletBalanceAfter).toBe(first.walletBalanceAfter)
    expect(second.breakdown).toEqual(first.breakdown)

    // No second debit / transaction / usage log / events.
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('1.749999')
    expect(txRepo.transactions).toHaveLength(1)
    expect(usageRepo.logs).toHaveLength(1)
    expect(events).toHaveLength(2)
  })

  it('rejects the same key with a different request payload', async () => {
    await service.charge(buildChargeInput())
    await expect(
      service.charge(buildChargeInput({ requestId: 'req-2' }))
    ).rejects.toMatchObject({ code: IdempotencyErrorCode.KEY_REUSED_WITH_DIFFERENT_REQUEST })
  })

  it('stores a deterministic replay response', async () => {
    const first = await service.charge(buildChargeInput())
    const second = await service.charge(buildChargeInput())
    // Everything except the replayed flag is byte-identical.
    expect({ ...first, replayed: undefined }).toEqual({ ...second, replayed: undefined })
  })
})

describe('ChargeService — ADR-0001 negative balance floor', () => {
  it('allows a charge that stays within the floor (balance goes negative)', async () => {
    walletRepo.seed('user-2', '8.20')
    const result = await service.charge(
      buildChargeInput({ userId: 'user-2', idempotencyKey: 'key-2' })
    )

    expect(result.walletBalanceAfter).toBe('-0.050001') // 8.20 - 8.250001, >= -0.10
    expect(result.walletStatus).toBe('PAYMENT_REQUIRED')
    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.status).toBe('PAYMENT_REQUIRED')
    expect(events).toContain(`charged:${BIG_CHARGE}:PAYMENT_REQUIRED`)
  })

  it('rejects a charge that exceeds the floor — nothing is persisted', async () => {
    walletRepo.seed('user-2', '8.00')
    await expect(
      service.charge(buildChargeInput({ userId: 'user-2', idempotencyKey: 'key-2' }))
    ).rejects.toMatchObject({ code: ChargeErrorCode.FLOOR_EXCEEDED })

    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('8')
    expect(wallet!.status).toBe('ACTIVE')
    expect(txRepo.transactions).toHaveLength(0)
    expect(usageRepo.logs).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('honors a custom floor override', async () => {
    walletRepo.seed('user-2', '8.00')
    const result = await service.charge(
      buildChargeInput({
        userId: 'user-2',
        idempotencyKey: 'key-2',
        maxNegativeBalance: Money.fromString('0.30', 'USD'),
      })
    )
    expect(result.walletBalanceAfter).toBe('-0.250001') // >= -0.30 → allowed
    expect(result.walletStatus).toBe('PAYMENT_REQUIRED')
  })

  it('rejects a negative floor override', async () => {
    await expect(
      service.charge(
        buildChargeInput({ maxNegativeBalance: Money.fromString('-0.10', 'USD') })
      )
    ).rejects.toMatchObject({ code: ChargeErrorCode.CHARGE_FAILED })
  })
})

describe('ChargeService — failure & rollback', () => {
  it('rolls back everything when the usage log insert fails', async () => {
    usageRepo.failCreate = true
    await expect(service.charge(buildChargeInput())).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10') // debit rolled back
    expect(txRepo.transactions).toHaveLength(0)
    expect(usageRepo.logs).toHaveLength(0)
    expect(idemRepo.keys).toHaveLength(0) // reservation rolled back too
    expect(events).toHaveLength(0)
  })

  it('rolls back when the AI_USAGE transaction cannot be created (partial update impossible)', async () => {
    // Second charge with a DIFFERENT key but the SAME requestId → the
    // transaction reference charge_req-1 already exists → unique violation.
    await service.charge(buildChargeInput())
    await expect(
      service.charge(buildChargeInput({ idempotencyKey: 'key-2' }))
    ).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('1.749999') // debited exactly once
    expect(txRepo.transactions).toHaveLength(1)
    expect(usageRepo.logs).toHaveLength(1)
    expect(events).toHaveLength(2) // events only from the first charge
  })

  it('throws PRICING_NOT_FOUND for an unknown pricing version', async () => {
    await expect(
      service.charge(buildChargeInput({ pricingVersionId: 'pv-missing' }))
    ).rejects.toMatchObject({ code: ChargeErrorCode.PRICING_NOT_FOUND })
    expect(txRepo.transactions).toHaveLength(0)
    expect(usageRepo.logs).toHaveLength(0)
  })

  it('throws WALLET_NOT_FOUND for a user without a wallet', async () => {
    await expect(
      service.charge(buildChargeInput({ userId: 'ghost' }))
    ).rejects.toMatchObject({ code: ChargeErrorCode.WALLET_NOT_FOUND })
  })

  it('never emits events on failure', async () => {
    usageRepo.failCreate = true
    await expect(service.charge(buildChargeInput())).rejects.toThrow()
    expect(events).toHaveLength(0)
  })
})

describe('ChargeService — optimistic locking & concurrency', () => {
  it('increments the wallet version on each settlement (optimistic locking)', async () => {
    const before = await walletRepo.findByUserId('user-1')!
    expect(before!.version).toBe(1)

    await service.charge(buildChargeInput())

    const after = await walletRepo.findByUserId('user-1')!
    expect(after!.version).toBe(2)
  })

  it('race: two parallel charges with the same key apply the charge exactly once', async () => {
    const outcomes = await Promise.allSettled([
      service.charge(buildChargeInput()),
      service.charge(buildChargeInput()),
    ])

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')

    // Exactly one charge is applied; the concurrent duplicate either replays
    // the winner's stored result or (with a real DB lock) hits IN_PROGRESS.
    const applied = fulfilled.filter(
      (o) => o.status === 'fulfilled' && !o.value.replayed
    )
    expect(applied).toHaveLength(1)
    const replayed = fulfilled.filter((o) => o.status === 'fulfilled' && o.value.replayed)
    expect(replayed.length + (outcomes.length - fulfilled.length)).toBe(1)

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('1.749999') // debited exactly once
    expect(txRepo.transactions).toHaveLength(1)
    expect(usageRepo.logs).toHaveLength(1)
    expect(events).toHaveLength(2)
  })

  it('rejects a concurrent in-flight duplicate (IN_PROGRESS)', async () => {
    // Simulate another request that already reserved the key but has not
    // committed yet (the real DB path: unique constraint + row lock).
    await idemService.reserve({
      key: 'key-1',
      scope: 'billing:usage',
      userId: 'user-1',
      request: {
        userId: 'user-1',
        modelId: 'model-1',
        pricingVersionId: 'pv-model-1-1',
        requestId: 'req-1',
        usage: { promptTokens: 10_000_000, completionTokens: 10_000_000, cachedTokens: 0 },
      },
    })

    await expect(service.charge(buildChargeInput())).rejects.toMatchObject({
      code: IdempotencyErrorCode.IN_PROGRESS,
    })

    // Nothing was persisted by the rejected duplicate.
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10')
    expect(txRepo.transactions).toHaveLength(0)
    expect(usageRepo.logs).toHaveLength(0)
    expect(events).toHaveLength(0)
  })
})

describe('ChargeService — deterministic result', () => {
  it('identical inputs produce identical results across users', async () => {
    walletRepo.seed('user-2', '10.00')
    const a = await service.charge(buildChargeInput({ idempotencyKey: 'key-a' }))
    const b = await service.charge(
      buildChargeInput({ userId: 'user-2', requestId: 'req-2', idempotencyKey: 'key-b' })
    )
    expect(a.breakdown).toEqual(b.breakdown)
    expect(a.walletBalanceAfter).toBe(b.walletBalanceAfter)
    expect(a.usage).toEqual(b.usage)
    expect(a.chargeId).not.toBe(b.chargeId)
  })
})

describe('ChargeService — integration with UsageMeter (chargeRaw)', () => {
  it('meters raw provider usage then charges', async () => {
    const raw = {
      prompt_tokens: 66,
      completion_tokens: 100,
      total_tokens: 166,
      prompt_tokens_details: { cached_tokens: 15 },
      completion_tokens_details: { reasoning_tokens: 20 },
    }
    const result = await service.chargeRaw({
      requestId: 'req-raw',
      userId: 'user-1',
      modelId: 'model-1',
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
      pricingVersionId: 'pv-model-1-1',
      rawUsage: raw,
      idempotencyKey: 'key-raw',
    })

    // UsageMeter normalization: cached decomposed from prompt.
    expect(result.usage).toEqual({
      promptTokens: 51,
      completionTokens: 100,
      cachedTokens: 15,
      totalTokens: 166,
    })
    const log = usageRepo.logs[0]!
    expect(log.promptTokens).toBe(51)
    expect(log.cachedTokens).toBe(15)
    expect(log.totalTokens).toBe(166)
  })

  it('rejects malformed raw usage before touching the wallet', async () => {
    await expect(
      service.chargeRaw({
        requestId: 'req-bad',
        userId: 'user-1',
        modelId: 'model-1',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        pricingVersionId: 'pv-model-1-1',
        rawUsage: { prompt_tokens: -1, completion_tokens: 5 },
        idempotencyKey: 'key-bad',
      })
    ).rejects.toThrow()

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10')
    expect(usageRepo.logs).toHaveLength(0)
  })
})

describe('WalletService — PAYMENT_REQUIRED reactivation (ADR-0001)', () => {
  it('crediting a PAYMENT_REQUIRED wallet back to >= 0 reactivates it', async () => {
    walletRepo.seed('user-2', '-0.05', 'PAYMENT_REQUIRED')
    await walletService.credit('user-2', Money.fromString('0.10', 'USD'), {
      reference: 'topup-1',
      type: 'TOPUP',
    })

    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('0.05')
    expect(wallet!.status).toBe('ACTIVE')
  })

  it('keeps PAYMENT_REQUIRED when a credit does not reach zero', async () => {
    walletRepo.seed('user-2', '-0.50', 'PAYMENT_REQUIRED')
    await walletService.credit('user-2', Money.fromString('0.10', 'USD'), {
      reference: 'topup-1',
      type: 'TOPUP',
    })

    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('-0.4')
    expect(wallet!.status).toBe('PAYMENT_REQUIRED')
  })

  it('debitWithFloor (public wrapper) emits wallet.debited after its own tx', async () => {
    const before = await walletRepo.findByUserId('user-1')!
    expect(before!.balance.toString()).toBe('10')

    const tx = await walletService.debitWithFloor(
      'user-1',
      Money.fromString('3.00', 'USD'),
      Money.fromString('0.10', 'USD'),
      { reference: 'df-1', type: 'AI_USAGE' }
    )

    expect(tx.type).toBe('AI_USAGE')
    expect(events).toContain('debited:3.000000')
    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('7')
  })
})
