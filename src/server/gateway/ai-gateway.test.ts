// ProxyAI — AIGateway Unit & Integration Tests
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// Full-pipeline integration: REAL EstimateService, PricingEngine,
// ChargeService, IdempotencyService, UsageMeter and DeepSeekProvider.
// Only persistence (repos) and HTTP (transport) are faked. No database.

import { describe, it, expect, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, UsageLog, IdempotencyKey, PricingVersion } from '@prisma/client'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import { WalletService } from '@/server/wallet/wallet.service'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'
import { IdempotencyService } from '@/server/idempotency/idempotency.service'
import type { IdempotencyKeyRepository, IdempotencyKeyCreateInput } from '@/server/idempotency/idempotency-key.repository'
import type { UsageRepository, UsageLogCreateInput } from '@/server/usage/usage.repository'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import { PricingEngine } from '@/server/billing/pricing-engine'
import { createUsageMeter } from '@/server/billing/usage-meter'
import { EstimateService } from '@/server/billing/estimate.service'
import { ChargeService } from '@/server/billing/charge.service'
import { BillingSummary, BillingSummaryError } from '@/server/gateway/billing-summary'
import { RequestContext, RequestContextError } from '@/server/gateway/request-context'
import { DeepSeekProvider } from '@/server/providers/deepseek-provider'
import { AIGateway, GatewayError, GatewayErrorCode } from '@/server/gateway/ai-gateway'
import { Money } from '@/lib/money'
import type { ProviderTransport } from '@/server/gateway/provider-types'

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

// ─── Fakes (persistence) ────────────────────────────────────────────────

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

  addVersion(modelId: string) {
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
    if (this.failCreate) throw new Error('DB failure: usage log insert failed')
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

// ─── Fake transport (HTTP boundary) ─────────────────────────────────────

const deepseekPayload = {
  id: 'chatcmpl-abc123',
  model: 'deepseek-chat',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello from DeepSeek!' },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 66,
    completion_tokens: 100,
    total_tokens: 166,
    prompt_tokens_details: { cached_tokens: 15 },
  },
}

class FakeTransport implements ProviderTransport {
  calls: Array<{ path: string; body: Record<string, unknown>; headers?: Record<string, string> }> = []
  getCalls: string[] = []
  handler: (
    path: string,
    body: unknown,
    options?: { signal?: AbortSignal }
  ) => Promise<unknown> = async () => deepseekPayload

  async post(path: string, body: unknown, options?: { headers?: Record<string, string>; signal?: AbortSignal }) {
    this.calls.push({ path, body: body as Record<string, unknown>, headers: options?.headers })
    return this.handler(path, body, options)
  }

  async get(path: string) {
    this.getCalls.push(path)
    return { object: 'list' }
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────

let walletRepo: FakeWalletRepository
let txRepo: FakeTransactionRepository
let pricingRepo: FakePricingRepo
let usageRepo: FakeUsageRepository
let idemRepo: FakeIdempotencyRepository
let txManager: FakeTransactionManager
let transport: FakeTransport
let dispatcher: EventDispatcher
let gateway: AIGateway
let provider: DeepSeekProvider

function buildRequest(overrides: Partial<Parameters<AIGateway['process']>[0]> = {}) {
  return {
    requestId: 'req-1',
    correlationId: 'corr-1',
    userId: 'user-1',
    model: 'deepseek-chat',
    modelId: 'model-1',
    pricingVersionId: 'pv-model-1-1',
    messages: [{ role: 'user' as const, content: 'Hello!' }],
    temperature: 0.7,
    maxTokens: 256,
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
  transport = new FakeTransport()

  const walletService = new WalletService(walletRepo, txRepo, txManager, dispatcher)
  const idemService = new IdempotencyService(idemRepo)
  const engine = new PricingEngine()
  const usageMeter = createUsageMeter()

  const estimateService = new EstimateService(pricingRepo, walletService, engine)
  const chargeService = new ChargeService(
    pricingRepo,
    usageRepo,
    walletService,
    idemService,
    txManager,
    engine,
    dispatcher,
    usageMeter
  )
  provider = new DeepSeekProvider({ usageMeter, transport })

  gateway = new AIGateway(estimateService, provider, usageMeter, chargeService)

  pricingRepo.addVersion('model-1')
  walletRepo.seed('user-1', '10.00')
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('AIGateway — normal flow', () => {
  it('orchestrates estimate → provider → meter → charge → response', async () => {
    const response = await gateway.process(buildRequest())

    // Response mapping
    expect(response.response.content).toBe('Hello from DeepSeek!')
    expect(response.response.finishReason).toBe('stop')
    expect(response.response.providerRequestId).toBe('chatcmpl-abc123')
    expect(response.provider).toBe('deepseek')

    // UsageMeter normalization (cached decomposed from prompt)
    expect(response.usage.promptTokens).toBe(51)
    expect(response.usage.completionTokens).toBe(100)
    expect(response.usage.cachedTokens).toBe(15)
    expect(response.usage.totalTokens).toBe(166)

    // Billing summary (exact money)
    expect(response.billing).toBeInstanceOf(BillingSummary)
    expect(response.billing.totalCost.toString()).toBe('0.000077')
    expect(response.billing.currency).toBe('USD')
    expect(response.billing.walletBalanceBefore.toString()).toBe('10.000000')
    expect(response.billing.walletBalanceAfter.toString()).toBe('9.999923')
    expect(response.billing.walletStatusAfter).toBe('ACTIVE')
    expect(response.billing.pricingVersionId).toBe('pv-model-1-1')
    expect(response.billing.transactionId).toMatch(/^txn-/)
    expect(response.billing.usageLogId).toMatch(/^usage-/)

    // Latency + identity
    expect(response.latency.totalMs).toBeGreaterThanOrEqual(0)
    expect(response.latency.providerMs).toBeGreaterThanOrEqual(0)
    expect(response.latency.billingMs).toBeGreaterThanOrEqual(0)
    expect(response.requestId).toBe('req-1')
    expect(response.correlationId).toBe('corr-1')

    // Exactly one provider call and one settlement.
    expect(transport.calls).toHaveLength(1)
    expect(usageRepo.logs).toHaveLength(1)
    expect(txRepo.transactions).toHaveLength(1)
  })

  it('passes the provider request in OpenAI-compatible shape', async () => {
    await gateway.process(buildRequest())
    const body = transport.calls[0]!.body
    expect(body.model).toBe('deepseek-chat')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello!' }])
    expect(body.temperature).toBe(0.7)
    expect(body.max_tokens).toBe(256)
    expect(body.stream).toBe(false)
    expect(body.top_p).toBeUndefined()
  })

  it('forwards RequestContext into the provider and the charge', async () => {
    await gateway.process(buildRequest())

    // Provider-side tracing metadata travels in a provider-owned header
    // (the request body stays strictly OpenAI-compatible).
    const metadata = JSON.parse(
      transport.calls[0]!.headers!['x-request-metadata']
    ) as Record<string, unknown>
    expect(metadata.correlationId).toBe('corr-1')
    expect(metadata.requestId).toBe('req-1')
    expect(metadata.userId).toBe('user-1')

    // Charge ran for the same request/user (usage log audit trail).
    const log = usageRepo.logs[0]!
    expect(log.requestId).toBe('req-1')
    expect(log.userId).toBe('user-1')
    expect(log.provider).toBe('deepseek')
    expect(log.model).toBe('deepseek-chat')
    expect(log.modelId).toBe('model-1')
  })
})

describe('AIGateway — estimate gate', () => {
  it('stops before the provider when the estimate is rejected', async () => {
    walletRepo.seed('user-2', '-0.50', 'PAYMENT_REQUIRED')

    await expect(
      gateway.process(buildRequest({ userId: 'user-2' }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.ESTIMATE_REJECTED })

    expect(transport.calls).toHaveLength(0) // provider NOT called
    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('stops before the provider when the estimate fails (no pricing)', async () => {
    await expect(
      gateway.process(buildRequest({ modelId: 'model-missing', pricingVersionId: 'pv-model-missing-1' }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.ESTIMATE_FAILED })

    expect(transport.calls).toHaveLength(0)
    expect(usageRepo.logs).toHaveLength(0)
  })
})

describe('AIGateway — provider failures (never charge)', () => {
  it('provider timeout → PROVIDER_TIMEOUT, nothing charged', async () => {
    transport.handler = (_path, _body, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        )
      })

    await expect(
      gateway.process(buildRequest(), { providerTimeoutMs: 20 })
    ).rejects.toMatchObject({ code: GatewayErrorCode.PROVIDER_TIMEOUT })

    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('provider error → PROVIDER_ERROR, nothing charged', async () => {
    transport.handler = async () => {
      const err = new Error('Provider responded 500: boom') as Error & { name: string }
      err.name = 'ProviderTransportError'
      throw err
    }

    await expect(gateway.process(buildRequest())).rejects.toMatchObject({
      code: GatewayErrorCode.PROVIDER_ERROR,
    })
    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('malformed ProviderResponse → MALFORMED_PROVIDER_RESPONSE, nothing charged', async () => {
    transport.handler = async () => ({ id: 'chatcmpl-x', model: 'deepseek-chat' })

    await expect(gateway.process(buildRequest())).rejects.toMatchObject({
      code: GatewayErrorCode.MALFORMED_PROVIDER_RESPONSE,
    })
    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('malformed usage → USAGE_PARSE_FAILED, nothing charged', async () => {
    transport.handler = async () => ({
      ...deepseekPayload,
      usage: { prompt_tokens: -5, completion_tokens: 10, total_tokens: 5 },
    })

    await expect(gateway.process(buildRequest())).rejects.toMatchObject({
      code: GatewayErrorCode.USAGE_PARSE_FAILED,
    })
    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })
})

describe('AIGateway — charge failure (documented)', () => {
  it('provider succeeded but billing failed → actionable CHARGE_FAILED', async () => {
    usageRepo.failCreate = true

    let error: GatewayError | undefined
    try {
      await gateway.process(buildRequest())
      expect.unreachable('charge failure should throw')
    } catch (caught) {
      error = caught as GatewayError
    }

    expect(error!.code).toBe(GatewayErrorCode.CHARGE_FAILED)

    // The provider WAS called (request already served) — must be documented.
    expect(transport.calls).toHaveLength(1)

    expect(error!.details.charge_code).toBe('CHARGE_FAILED')
    expect(error!.details.request_id).toBe('req-1')
    expect(typeof error!.details.remediation).toBe('string')
    expect(error!.message).toContain('unexpectedly') // charge-level error surfaced
  })
})

describe('AIGateway — deduplication & retry policy', () => {
  it('never retries the provider, but the charge is idempotent (no double billing)', async () => {
    const first = await gateway.process(buildRequest())
    const second = await gateway.process(buildRequest()) // same requestId

    // Provider called once per gateway invocation — the gateway never retries
    // (documented). The charge, however, settled exactly once.
    expect(transport.calls).toHaveLength(2)
    expect(usageRepo.logs).toHaveLength(1)
    expect(txRepo.transactions).toHaveLength(1)

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('9.999923') // debited once

    expect(second.billing.transactionId).toBe(first.billing.transactionId)
    expect(second.billing.usageLogId).toBe(first.billing.usageLogId)
  })
})

describe('AIGateway — validation', () => {
  it('rejects streaming requests (out of scope)', async () => {
    await expect(
      gateway.process(buildRequest({ stream: true }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.VALIDATION_FAILED })
    expect(transport.calls).toHaveLength(0)
  })

  it('rejects empty messages and invalid temperature', async () => {
    await expect(
      gateway.process(buildRequest({ messages: [] }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.VALIDATION_FAILED })
    await expect(
      gateway.process(buildRequest({ temperature: 3 }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.VALIDATION_FAILED })
    await expect(
      gateway.process(buildRequest({ messages: [{ role: 'admin' as never, content: 'x' }] }))
    ).rejects.toMatchObject({ code: GatewayErrorCode.VALIDATION_FAILED })
    expect(transport.calls).toHaveLength(0)
  })
})

describe('AIGateway — deterministic', () => {
  it('identical inputs produce identical stable fields', async () => {
    walletRepo.seed('user-2', '10.00')
    const a = await gateway.process(buildRequest({ requestId: 'req-a', correlationId: 'corr-a' }))
    const b = await gateway.process(
      buildRequest({ requestId: 'req-b', correlationId: 'corr-b', userId: 'user-2' })
    )

    expect(a.response).toEqual(b.response)
    expect(a.usage).toEqual(b.usage)
    expect(a.provider).toBe(b.provider)
    expect(a.billing.totalCost.toString()).toBe(b.billing.totalCost.toString())
    expect(a.billing.walletBalanceBefore.toString()).toBe(b.billing.walletBalanceBefore.toString())
    expect(a.billing.walletBalanceAfter.toString()).toBe(b.billing.walletBalanceAfter.toString())
    expect(a.latency.totalMs).toBeGreaterThanOrEqual(0)
  })
})

describe('DeepSeekProvider — contract', () => {
  it('exposes correct ProviderCapabilities', () => {
    const caps = provider.capabilities()
    expect(caps.streaming).toBe(true)
    expect(caps.vision).toBe(false)
    expect(caps.reasoning).toBe(true)
    expect(caps.toolCalling).toBe(false)
    expect(caps.jsonMode).toBe(true)
    expect(caps.embeddings).toBe(false)
    expect(caps.imageGeneration).toBe(false)
    expect(caps.maxContextTokens).toBe(64_000)
    expect(caps.supportedModels).toContain('deepseek-chat')
  })

  it('maps ProviderResponse correctly (never exposes raw)', async () => {
    const response = await provider.chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(response.provider).toBe('deepseek')
    expect(response.model).toBe('deepseek-chat')
    expect(response.providerRequestId).toBe('chatcmpl-abc123')
    expect(response.content).toBe('Hello from DeepSeek!')
    expect(response.finishReason).toBe('stop')
    expect(response.usage.totalTokens).toBe(166)
    expect(response.rawUsage).toBe(deepseekPayload.usage) // raw preserved for audit
    expect(response.raw).toBe(deepseekPayload)
  })

  it('estimates prompt context from messages', () => {
    const estimate = provider.estimateContext({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
      ],
    })
    expect(estimate.promptTokens).toBeGreaterThan(0)
    expect(estimate.completionTokens).toBe(0)
  })

  it('health() uses a GET (never pays for a health check)', async () => {
    const result = await provider.health()
    expect(result.ok).toBe(true)
    expect(transport.getCalls).toContain('/models')
  })
})

describe('RequestContext — domain object', () => {
  it('validates identity fields', () => {
    expect(() =>
      RequestContext.create({ requestId: '', correlationId: 'c', userId: 'u' })
    ).toThrow(RequestContextError)
    expect(() =>
      RequestContext.create({ requestId: 'r', correlationId: '', userId: 'u' })
    ).toThrow(RequestContextError)
  })

  it('produces structured log context with the correlation id', () => {
    const ctx = RequestContext.create({
      requestId: 'req-1',
      correlationId: 'corr-1',
      userId: 'user-1',
      clientIp: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(ctx.toLogContext()).toMatchObject({
      request_id: 'req-1',
      correlation_id: 'corr-1',
      user_id: 'user-1',
      client_ip: '1.2.3.4',
      user_agent: 'test-agent',
    })
    expect(ctx.elapsedMs()).toBeGreaterThanOrEqual(0)
  })
})

describe('BillingSummary — domain object', () => {
  it('validates currency consistency across money fields', () => {
    expect(() =>
      BillingSummary.create({
        transactionId: 't',
        usageLogId: 'u',
        pricingVersionId: 'p',
        totalCost: Money.fromString('0.000077', 'USD'),
        currency: 'USD',
        walletBalanceBefore: Money.fromString('10', 'USD'),
        walletBalanceAfter: Money.fromString('10', 'IDR'),
        walletStatusAfter: 'ACTIVE',
      })
    ).toThrow(BillingSummaryError)
  })

  it('holds money as Money value objects', () => {
    const summary = BillingSummary.create({
      transactionId: 't-1',
      usageLogId: 'u-1',
      pricingVersionId: 'p-1',
      totalCost: Money.fromString('0.000077', 'USD'),
      currency: 'USD',
      walletBalanceBefore: Money.fromString('10.000000', 'USD'),
      walletBalanceAfter: Money.fromString('9.999923', 'USD'),
      walletStatusAfter: 'ACTIVE',
    })
    expect(summary.totalCost).toBeInstanceOf(Money)
    expect(summary.totalCost.toString()).toBe('0.000077')
  })
})
