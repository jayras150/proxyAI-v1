// ProxyAI — AI Gateway REST API Route Tests (Integration)
// Billing Milestone 8 — REST API Layer
//
// Full-stack route tests: real AIGateway + EstimateService + ChargeService
// + RefundService + DeepSeekProvider; persistence + HTTP faked. Covers
// validation, auth (JWT + API key), error mapping, rate limiting, OpenAPI.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import type {
  Wallet,
  Transaction,
  UsageLog,
  IdempotencyKey,
  PricingVersion,
  AiModel,
  ApiKey,
} from '@prisma/client'
import { makeRequest, signAccessToken } from './test-helpers'
import { hashApiKey } from '@/lib/crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import { WalletService } from '@/server/wallet/wallet.service'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'
import { TransactionService } from '@/server/transactions/transaction.service'
import { IdempotencyService } from '@/server/idempotency/idempotency.service'
import type { IdempotencyKeyRepository, IdempotencyKeyCreateInput } from '@/server/idempotency/idempotency-key.repository'
import type { UsageRepository, UsageLogCreateInput } from '@/server/usage/usage.repository'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import type { ModelRepository } from '@/server/models/model.repository'
import type { ApiKeyRepository } from '@/server/api-keys/api-key.repository'
import { ModelService } from '@/server/models/model.service'
import { PricingEngine } from '@/server/billing/pricing-engine'
import { createUsageMeter } from '@/server/billing/usage-meter'
import { EstimateService } from '@/server/billing/estimate.service'
import { ChargeService } from '@/server/billing/charge.service'
import { RefundService } from '@/server/billing/refund.service'
import { DeepSeekProvider } from '@/server/providers/deepseek-provider'
import { AIGateway } from '@/server/gateway/ai-gateway'
import type { ProviderTransport } from '@/server/gateway/provider-types'

vi.mock('@/server/composition', () => ({
  getApiServices: () => mockServices,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockServices: any

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

class FakeModelRepo implements ModelRepository {
  models: AiModel[] = []

  seed(overrides: Partial<AiModel> = {}) {
    const model: AiModel = {
      id: 'model-1',
      displayName: 'DeepSeek Chat',
      provider: 'deepseek',
      modelId: 'deepseek-chat',
      contextWindow: 64_000,
      enabled: true,
      capabilities: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
    this.models.push(model)
    return model
  }

  async findByModelId(modelId: string) {
    return this.models.find((m) => m.modelId === modelId) ?? null
  }

  async listEnabled() {
    return this.models.filter((m) => m.enabled)
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

  seedUsage(overrides: Partial<UsageLog> = {}) {
    const log: UsageLog = {
      id: `usage-${++this.seq}`,
      userId: 'user-1',
      apiKeyId: null,
      provider: 'deepseek',
      model: 'deepseek-chat',
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

  async aggregatePeriod(userId: string, from: Date, to: Date) {
    const charged = this.logs.filter(
      (l) => l.userId === userId && l.status === 'COMPLETED' && l.createdAt >= from && l.createdAt < to
    )
    return {
      requests: charged.length,
      tokens: charged.reduce((sum, l) => sum + l.totalTokens, 0),
      cost: charged.reduce((sum, l) => sum.plus(l.userCost), new Prisma.Decimal(0)),
    }
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

class FakeApiKeyRepository implements ApiKeyRepository {
  keys = new Map<string, ApiKey>()

  seed(key: string, userId: string, status: ApiKey['status'] = 'ACTIVE') {
    const apiKey: ApiKey = {
      id: `ak-${userId}`,
      userId,
      name: 'test',
      keyPrefix: key.slice(0, 12),
      keyHash: hashApiKey(key),
      lastUsedAt: null,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.keys.set(apiKey.keyHash, apiKey)
    return apiKey
  }

  async findByHash(hash: string) {
    return this.keys.get(hash) ?? null
  }

  async touchLastUsed(id: string) {
    const key = [...this.keys.values()].find((k) => k.id === id)
    if (key) key.lastUsedAt = new Date()
  }

  async countActiveByUserId(userId: string) {
    return [...this.keys.values()].filter((k) => k.userId === userId && k.status === 'ACTIVE').length
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

const deepseekPayload = {
  id: 'chatcmpl-abc123',
  model: 'deepseek-chat',
  choices: [
    { index: 0, message: { role: 'assistant', content: 'Hello from DeepSeek!' }, finish_reason: 'stop' },
  ],
  usage: {
    prompt_tokens: 66,
    completion_tokens: 100,
    total_tokens: 166,
    prompt_tokens_details: { cached_tokens: 15 },
  },
}

class FakeTransport implements ProviderTransport {
  calls: number = 0
  handler: (options?: { signal?: AbortSignal }) => Promise<unknown> = async () => deepseekPayload

  async post(_path: string, _body: unknown, options?: { signal?: AbortSignal }) {
    this.calls += 1
    return this.handler(options)
  }

  async get() {
    return { object: 'list' }
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────

let walletRepo: FakeWalletRepository
let txRepo: FakeTransactionRepository
let pricingRepo: FakePricingRepo
let modelRepo: FakeModelRepo
let usageRepo: FakeUsageRepository
let idemRepo: FakeIdempotencyRepository
let apiKeyRepo: FakeApiKeyRepository
let txManager: FakeTransactionManager
let transport: FakeTransport
let routes: {
  chat: { POST: (req: NextRequest) => Promise<NextResponse> }
  models: { GET: (req: NextRequest) => Promise<NextResponse> }
  providers: { GET: (req: NextRequest) => Promise<NextResponse> }
  health: { GET: (req: NextRequest) => Promise<NextResponse> }
  estimate: { POST: (req: NextRequest) => Promise<NextResponse> }
  refund: { POST: (req: NextRequest) => Promise<NextResponse> }
  usage: { GET: (req: NextRequest) => Promise<NextResponse> }
  transactions: { GET: (req: NextRequest) => Promise<NextResponse> }
}

const chatBody = () => ({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7,
  max_tokens: 256,
})

async function importRoutes() {
  routes = {
    chat: await import('./chat/completions/route'),
    models: await import('./models/route'),
    providers: await import('./providers/route'),
    health: await import('./health/route'),
    estimate: await import('./estimate/route'),
    refund: await import('./refund/route'),
    usage: await import('./usage/route'),
    transactions: await import('./transactions/route'),
  }
}

beforeEach(async () => {
  vi.resetModules()
  walletRepo = new FakeWalletRepository()
  txRepo = new FakeTransactionRepository()
  pricingRepo = new FakePricingRepo()
  modelRepo = new FakeModelRepo()
  usageRepo = new FakeUsageRepository()
  idemRepo = new FakeIdempotencyRepository()
  apiKeyRepo = new FakeApiKeyRepository()
  txManager = new FakeTransactionManager([walletRepo, txRepo, usageRepo, idemRepo, pricingRepo])
  transport = new FakeTransport()

  const dispatcher = new LocalEventDispatcher()
  const walletService = new WalletService(walletRepo, txRepo, txManager, dispatcher)
  const transactionService = new TransactionService(txRepo)
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
  const refundService = new RefundService(
    refundRepoFake(),
    usageRepo,
    walletService,
    idemService,
    txManager,
    dispatcher
  )
  const provider = new DeepSeekProvider({ usageMeter, transport })
  const aiGateway = new AIGateway(estimateService, provider, usageMeter, chargeService, 40)
  const modelService = new ModelService(modelRepo, pricingRepo)

  pricingRepo.addVersion('model-1')
  modelRepo.seed()
  walletRepo.seed('user-1', '10.00')
  apiKeyRepo.seed('pk_live_testkey1234567890abcdef', 'user-1')

  mockServices = {
    walletService,
    transactionService,
    estimateService,
    chargeService,
    refundService,
    aiGateway,
    modelService,
    usageRepository: usageRepo,
    apiKeyRepository: apiKeyRepo,
    providerInfo: { id: 'deepseek', version: '1.0.0', capabilities: provider.capabilities() },
    providerHealth: async () => ({ ok: true, latencyMs: 5 }),
    estimateUsage: (request: { model: string; messages: { role: string; content: string }[] }) =>
      provider.estimateContext({
        model: request.model,
        messages: request.messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
      }),
  }

  await importRoutes()
})

// RefundService needs a RefundRepository — minimal in-memory fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refundRepoFake(): any {
  const refunds: Array<{ id?: string; usageLogId: string; status?: string; version?: number; transactionId?: string | null }> = []
  return {
    async create(input: { usageLogId: string }) {
      if (refunds.some((r) => r.usageLogId === input.usageLogId)) {
        const err = new Error('duplicate') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
      const refund = {
        id: `refund-${refunds.length + 1}`,
        usageLogId: input.usageLogId,
        status: 'REQUESTED',
        version: 1,
        transactionId: null,
        approvedBy: null,
      }
      refunds.push(refund)
      return refund
    },
    async findByUsageLogId(usageLogId: string) {
      return refunds.find((r) => r.usageLogId === usageLogId) ?? null
    },
    async markCompleted(id: string, transactionId: string, version: number, _tx?: unknown, approvedBy?: string) {
      const refund = refunds.find((r) => r.id === id)
      if (!refund || refund.version !== version) return null
      refund.status = 'COMPLETED'
      refund.transactionId = transactionId
      return { id, transactionId, status: 'COMPLETED', version: version + 1, approvedBy: approvedBy ?? null }
    },
    async findById() {
      return null
    },
    async findByUserIdPaginated() {
      return { items: [], nextCursor: null, hasMore: false }
    },
    async updateStatus() {
      return null
    },
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/v1/chat/completions', () => {
  it('runs the full pipeline and returns an OpenAI-shaped completion with billing', async () => {
    const response = await routes.chat.POST(makeRequest('http://test/api/v1/chat/completions', {
      method: 'POST',
      body: chatBody(),
      token: signAccessToken(),
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.request_id).toBeTruthy()
    expect(body.data.id).toMatch(/^chatcmpl_/)
    expect(body.data.object).toBe('chat.completion')
    expect(body.data.choices[0].message.content).toBe('Hello from DeepSeek!')
    expect(body.data.choices[0].finish_reason).toBe('stop')
    expect(body.data.usage.prompt_tokens).toBe(51) // metered: cached decomposed
    expect(body.data.usage.prompt_tokens_details.cached_tokens).toBe(15)
    expect(body.data.billing.total_cost).toBe('0.000077')
    expect(body.data.billing.wallet_balance_before).toBe('10.000000')
    expect(body.data.billing.wallet_balance_after).toBe('9.999923')
    expect(body.data.billing.currency).toBe('USD')
    expect(body.data.latency.total_ms).toBeGreaterThanOrEqual(0)
  })

  it('authenticates with an API key (Bearer pk_live_...)', async () => {
    const response = await routes.chat.POST(makeRequest('http://test/api/v1/chat/completions', {
      method: 'POST',
      body: chatBody(),
      headers: { authorization: 'Bearer pk_live_testkey1234567890abcdef' },
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.billing.usage_log_id).toBeTruthy()
    expect(usageRepo.logs[0]!.userId).toBe('user-1')
  })

  it('rejects missing credentials with 401', async () => {
    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', { method: 'POST', body: chatBody() })
    )
    expect(response.status).toBe(401)
  })

  it('rejects an invalid API key with 401', async () => {
    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: chatBody(),
        headers: { authorization: 'Bearer pk_live_wrongkey' },
      })
    )
    expect(response.status).toBe(401)
  })

  it('validates the payload (400): stream, missing messages, bad temperature', async () => {
    for (const body of [
      { ...chatBody(), stream: true },
      { model: 'deepseek-chat', messages: [] },
      { ...chatBody(), temperature: 3 },
    ]) {
      const response = await routes.chat.POST(
        makeRequest('http://test/api/v1/chat/completions', {
          method: 'POST',
          body,
          token: signAccessToken(),
        })
      )
      expect(response.status).toBe(400)
      const parsed = await response.json()
      expect(parsed.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('maps unknown models to 404', async () => {
    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: { ...chatBody(), model: 'gpt-9' },
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(404)
  })

  it('maps estimate rejection to 402 and never calls the provider', async () => {
    walletRepo.seed('user-poor', '-0.50', 'PAYMENT_REQUIRED')
    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: chatBody(),
        token: signAccessToken({ sub: 'user-poor' }),
      })
    )
    expect(response.status).toBe(402)
    const parsed = await response.json()
    expect(parsed.error.code).toBe('ESTIMATE_REJECTED')
    expect(transport.calls).toBe(0)
  })

  it('maps provider timeouts to 504 and never charges', async () => {
    transport.handler = (options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        )
      })

    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: chatBody(),
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(504)
    expect(usageRepo.logs).toHaveLength(0)
  })

  it('maps provider errors to 502 and never charges', async () => {
    transport.handler = async () => {
      const err = new Error('Provider responded 500: boom') as Error & { name: string }
      err.name = 'ProviderTransportError'
      throw err
    }

    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: chatBody(),
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(502)
    expect(usageRepo.logs).toHaveLength(0)
  })

  it('maps charge failures to 500 with actionable details', async () => {
    usageRepo.failCreate = true
    const response = await routes.chat.POST(
      makeRequest('http://test/api/v1/chat/completions', {
        method: 'POST',
        body: chatBody(),
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(500)
    const parsed = await response.json()
    expect(parsed.error.code).toBe('CHARGE_FAILED')
    expect(transport.calls).toBe(1) // provider already served the request
  })

  it('rate limits at 60/min per identity (429)', async () => {
    const token = signAccessToken({ sub: 'user-rl' })
    walletRepo.seed('user-rl', '100.00')

    let lastStatus = 0
    for (let i = 0; i < 61; i += 1) {
      const response = await routes.chat.POST(
        makeRequest('http://test/api/v1/chat/completions', {
          method: 'POST',
          body: chatBody(),
          token,
        })
      )
      lastStatus = response.status
      if (response.status !== 200) break
    }
    expect(lastStatus).toBe(429)
  })
})

describe('POST /api/v1/estimate', () => {
  it('returns a read-only cost estimate (200, can_proceed)', async () => {
    const response = await routes.estimate.POST(
      makeRequest('http://test/api/v1/estimate', {
        method: 'POST',
        body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Hello!' }] },
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.model).toBe('deepseek-chat')
    expect(body.data.can_proceed).toBe(true)
    expect(body.data.estimated_cost).toBeTruthy()
    expect(body.data.currency).toBe('USD')
    // Read-only: nothing persisted, provider never called.
    expect(transport.calls).toBe(0)
    expect(usageRepo.logs).toHaveLength(0)
    expect(txRepo.transactions).toHaveLength(0)
  })

  it('reports can_proceed=false for a PAYMENT_REQUIRED wallet (still 200)', async () => {
    walletRepo.seed('user-poor', '-0.50', 'PAYMENT_REQUIRED')
    const response = await routes.estimate.POST(
      makeRequest('http://test/api/v1/estimate', {
        method: 'POST',
        body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Hi' }] },
        token: signAccessToken({ sub: 'user-poor' }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.can_proceed).toBe(false)
    expect(body.data.reason).toBe('PAYMENT_REQUIRED')
  })

  it('validates the payload and requires auth', async () => {
    const bad = await routes.estimate.POST(
      makeRequest('http://test/api/v1/estimate', {
        method: 'POST',
        body: { model: '' },
        token: signAccessToken(),
      })
    )
    expect(bad.status).toBe(400)

    const noAuth = await routes.estimate.POST(
      makeRequest('http://test/api/v1/estimate', {
        method: 'POST',
        body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] },
      })
    )
    expect(noAuth.status).toBe(401)
  })
})

describe('POST /api/v1/refund', () => {
  it('refunds a completed usage log (200)', async () => {
    usageRepo.seedUsage()
    const response = await routes.refund.POST(
      makeRequest('http://test/api/v1/refund', {
        method: 'POST',
        body: { usage_log_id: 'usage-1', idempotency_key: 'refund-key-1' },
        token: signAccessToken(),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.refund_status).toBe('COMPLETED')
    expect(body.data.usage_status).toBe('REFUNDED')
    expect(body.data.amount).toBe('0.000496')

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('10.000496')
  })

  it('rejects duplicate refunds with 409', async () => {
    usageRepo.seedUsage()
    await routes.refund.POST(
      makeRequest('http://test/api/v1/refund', {
        method: 'POST',
        body: { usage_log_id: 'usage-1', idempotency_key: 'k1' },
        token: signAccessToken(),
      })
    )
    const dup = await routes.refund.POST(
      makeRequest('http://test/api/v1/refund', {
        method: 'POST',
        body: { usage_log_id: 'usage-1', idempotency_key: 'k2' },
        token: signAccessToken(),
      })
    )
    expect(dup.status).toBe(409)
  })

  it('forbids non-admins from refunding another user (403)', async () => {
    usageRepo.seedUsage()
    const response = await routes.refund.POST(
      makeRequest('http://test/api/v1/refund', {
        method: 'POST',
        body: { usage_log_id: 'usage-1', user_id: 'user-2', idempotency_key: 'k1' },
        token: signAccessToken({ role: 'USER' }),
      })
    )
    expect(response.status).toBe(403)
  })

  it('allows admins to refund another user (200)', async () => {
    usageRepo.seedUsage({ id: 'usage-2', userId: 'user-2' })
    walletRepo.seed('user-2', '5.00')
    const response = await routes.refund.POST(
      makeRequest('http://test/api/v1/refund', {
        method: 'POST',
        body: { usage_log_id: 'usage-2', user_id: 'user-2', idempotency_key: 'k1' },
        token: signAccessToken({ role: 'ADMIN' }),
      })
    )
    expect(response.status).toBe(200)
    const wallet = await walletRepo.findByUserId('user-2')!
    expect(wallet!.balance.toString()).toBe('5.000496')
  })
})

describe('GET /v1/usage and /v1/transactions', () => {
  it('lists the user usage history (200)', async () => {
    usageRepo.seedUsage()
    const response = await routes.usage.GET(
      makeRequest('http://test/api/v1/usage?limit=10', { token: signAccessToken() })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].total_tokens).toBe(1500)
    expect(body.data.items[0].user_cost).toBe('0.000496')
    expect(body.data.has_more).toBe(false)
  })

  it('lists the user transaction history (200)', async () => {
    const wallet = await walletRepo.findByUserId('user-1')!
    await txRepo.create({
      walletId: wallet!.id,
      userId: 'user-1',
      amount: new Prisma.Decimal('1.00'),
      balanceBefore: new Prisma.Decimal('0'),
      balanceAfter: new Prisma.Decimal('1.00'),
      currency: 'USD',
      type: 'TOPUP',
      reference: 'topup-test-1',
    })

    const response = await routes.transactions.GET(
      makeRequest('http://test/api/v1/transactions?limit=10', { token: signAccessToken() })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.items.some((tx: { type: string }) => tx.type === 'TOPUP')).toBe(true)
  })

  it('requires auth (401)', async () => {
    const response = await routes.usage.GET(makeRequest('http://test/api/v1/usage'))
    expect(response.status).toBe(401)
  })

  it('treats a malformed cursor as start-of-list (200, never 500)', async () => {
    usageRepo.seedUsage()
    const response = await routes.usage.GET(
      makeRequest('http://test/api/v1/usage?cursor=%%%not-base64%%%', { token: signAccessToken() })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.items).toHaveLength(1)
  })
})

describe('GET /v1/models, /v1/providers, /v1/health', () => {
  it('lists enabled models (200, OpenAI shape)', async () => {
    const response = await routes.models.GET(
      makeRequest('http://test/api/v1/models', { token: signAccessToken() })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.object).toBe('list')
    expect(body.data.data[0].id).toBe('deepseek-chat')
    expect(body.data.data[0].owned_by).toBe('deepseek')
  })

  it('lists providers with capabilities (200)', async () => {
    const response = await routes.providers.GET(
      makeRequest('http://test/api/v1/providers', { token: signAccessToken() })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.data[0].id).toBe('deepseek')
    expect(body.data.data[0].capabilities.streaming).toBe(true)
    expect(body.data.data[0].capabilities.vision).toBe(false)
  })

  it('health is public and reports provider status (200)', async () => {
    const response = await routes.health.GET(makeRequest('http://test/api/v1/health'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.status).toBe('ok')
    expect(body.data.provider).toBe('deepseek')
    expect(body.data.provider_healthy).toBe(true)
  })
})
