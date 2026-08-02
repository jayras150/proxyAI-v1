// ProxyAI — DashboardSummaryService unit tests
// Covers period boundaries (UTC), COMPLETED-only spend, empty/zero state,
// wallet-not-found and the optional default-model config read.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, UsageLog, AiModel } from '@prisma/client'
import { DashboardSummaryService } from './dashboard-summary.service'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

// The service reads the optional default model from AiConfiguration.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiConfiguration: {
      findUnique: vi.fn(async () => null),
    },
  },
}))

import { prisma } from '@/lib/prisma'

function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: 'wallet-1',
    userId: 'user-1',
    balance: new Prisma.Decimal('12.345000'),
    currency: 'USD',
    status: 'ACTIVE',
    version: 1,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makeUsage(createdAt: Date, cost: string, status: UsageLog['status'] = 'COMPLETED'): UsageLog {
  return {
    id: `usage-${createdAt.getTime()}`,
    userId: 'user-1',
    apiKeyId: null,
    provider: 'deepseek',
    model: 'deepseek-chat',
    modelId: null,
    pricingVersionId: null,
    promptTokens: 100,
    completionTokens: 50,
    cachedTokens: 0,
    totalTokens: 150,
    providerCost: new Prisma.Decimal('0.000010'),
    userCost: new Prisma.Decimal(cost),
    currency: 'USD',
    latencyMs: null,
    status,
    requestId: null,
    inputPrice: null,
    outputPrice: null,
    markupPercent: null,
    serviceFee: null,
    createdAt,
  }
}

// ─── Fakes ────────────────────────────────────────────────────────────

class FakeWalletService {
  wallets = new Map<string, Wallet>()

  async getWallet(userId: string) {
    for (const w of this.wallets.values()) if (w.userId === userId) return w
    return null
  }
}

class FakeTxService {
  transactions: Transaction[] = []

  async getWalletHistory(_walletId: string, _cursor: string | null, limit: number) {
    const items = [...this.transactions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
    return { items, nextCursor: null, hasMore: this.transactions.length > limit }
  }
}

class FakeUsageRepository {
  logs: UsageLog[] = []

  async aggregatePeriod(_userId: string, from: Date, to: Date) {
    const charged = this.logs.filter(
      (l) => l.status === 'COMPLETED' && l.createdAt >= from && l.createdAt < to
    )
    return {
      requests: charged.length,
      tokens: charged.reduce((sum, l) => sum + l.totalTokens, 0),
      cost: charged.reduce((sum, l) => sum.plus(l.userCost), new Prisma.Decimal(0)),
    }
  }

  async findByUserIdPaginated(_userId: string, _cursor: null, limit: number) {
    const items = [...this.logs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
    return { items, nextCursor: null, hasMore: this.logs.length > limit }
  }
}

class FakeApiKeyRepository {
  active = 0
  async countActiveByUserId() {
    return this.active
  }
}

class FakeModelService {
  models: AiModel[] = []
  async list() {
    return this.models
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildService(fakes: any, providerStatus = async () => ({ id: 'deepseek', healthy: true, latency_ms: 12 })) {
  return new DashboardSummaryService(
    fakes.walletService,
    fakes.txService,
    fakes.usageRepository,
    fakes.apiKeyRepository,
    fakes.modelService,
    providerStatus
  )
}

const NOW = new Date('2026-08-01T12:00:00.000Z') // Aug 1 2026, midday UTC

describe('DashboardSummaryService', () => {
  let fakes: {
    walletService: FakeWalletService
    txService: FakeTxService
    usageRepository: FakeUsageRepository
    apiKeyRepository: FakeApiKeyRepository
    modelService: FakeModelService
  }

  beforeEach(() => {
    vi.mocked(prisma.aiConfiguration.findUnique).mockResolvedValue(null)
    fakes = {
      walletService: new FakeWalletService(),
      txService: new FakeTxService(),
      usageRepository: new FakeUsageRepository(),
      apiKeyRepository: new FakeApiKeyRepository(),
      modelService: new FakeModelService(),
    }
  })

  it('aggregates today / month / previous month with UTC boundaries', async () => {
    fakes.walletService.wallets.set('wallet-1', makeWallet())
    fakes.usageRepository.logs = [
      // Today (Aug 1): two COMPLETED logs
      makeUsage(new Date('2026-08-01T08:00:00.000Z'), '0.001000'),
      makeUsage(new Date('2026-08-01T09:00:00.000Z'), '0.002000'),
      // This month but yesterday (Jul 31 is PREVIOUS month in UTC? No — Jul 31 is July)
      makeUsage(new Date('2026-07-31T23:00:00.000Z'), '0.000500'),
      // Earlier this month (Aug) — same month bucket
      makeUsage(new Date('2026-08-01T00:30:00.000Z'), '0.000250'),
      // FAILED — never counted
      makeUsage(new Date('2026-08-01T10:00:00.000Z'), '9.000000', 'FAILED'),
      // REFUNDED — never counted
      makeUsage(new Date('2026-08-01T11:00:00.000Z'), '9.000000', 'REFUNDED'),
    ]

    const summary = await buildService(fakes).getSummary('user-1', NOW)

    // Today = Aug 1 00:00Z → Aug 2 00:00Z → 0.001000 + 0.002000 + 0.000250
    expect(summary.requests_today).toBe(3)
    expect(summary.tokens_today).toBe(450)
    expect(summary.spend_today).toBe('0.003250')
    // Month = Aug 1 → Sep 1 → the same three COMPLETED August logs
    expect(summary.spend_month).toBe('0.003250')
    // Previous month = Jul 1 → Aug 1 → the Jul 31 log
    expect(summary.spend_previous_month).toBe('0.000500')
  })

  it('returns zero spend for a fresh wallet (empty state)', async () => {
    fakes.walletService.wallets.set('wallet-1', makeWallet())

    const summary = await buildService(fakes).getSummary('user-1', NOW)

    expect(summary.balance).toBe('12.345000')
    expect(summary.wallet_status).toBe('ACTIVE')
    expect(summary.requests_today).toBe(0)
    expect(summary.tokens_today).toBe(0)
    expect(summary.spend_today).toBe('0.000000')
    expect(summary.spend_month).toBe('0.000000')
    expect(summary.spend_previous_month).toBe('0.000000')
    expect(summary.latest_transactions).toHaveLength(0)
    expect(summary.latest_usage).toHaveLength(0)
    expect(summary.active_keys).toBe(0)
    expect(summary.available_models).toBe(0)
  })

  it('caps recent transactions and usage at 5 and returns provider status', async () => {
    fakes.walletService.wallets.set('wallet-1', makeWallet())
    for (let i = 0; i < 7; i++) {
      const at = new Date(Date.UTC(2026, 7, 1, 0, i))
      fakes.usageRepository.logs.push(makeUsage(at, '0.000001'))
      fakes.txService.transactions.push({
        id: `txn-${i}`,
        walletId: 'wallet-1',
        userId: 'user-1',
        amount: new Prisma.Decimal('1.000000'),
        balanceBefore: new Prisma.Decimal('0.000000'),
        balanceAfter: new Prisma.Decimal('1.000000'),
        currency: 'USD',
        type: 'TOPUP',
        reference: `ref-${i}`,
        status: 'COMPLETED',
        description: null,
        requestId: null,
        providerReference: null,
        createdBy: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(Date.UTC(2026, 7, 1, 0, i)),
      } as Transaction)
    }
    fakes.apiKeyRepository.active = 2

    const summary = await buildService(
      fakes,
      (async () => ({ id: 'deepseek', healthy: false, latency_ms: null })) as unknown as () => Promise<{
        id: string
        healthy: boolean
        latency_ms: number
      }>
    ).getSummary(
      'user-1',
      NOW
    )

    expect(summary.latest_transactions).toHaveLength(5)
    expect(summary.latest_usage).toHaveLength(5)
    expect(summary.active_keys).toBe(2)
    expect(summary.provider).toEqual({ id: 'deepseek', healthy: false, latency_ms: null })
  })

  it('throws WALLET_NOT_FOUND when the user has no wallet', async () => {
    const promise = buildService(fakes).getSummary('user-1', NOW)
    await expect(promise).rejects.toThrow(WalletError)
    await expect(promise).rejects.toMatchObject({ code: WalletErrorCode.WALLET_NOT_FOUND })
  })

  it('reads the default model from AiConfiguration (string or {model})', async () => {
    fakes.walletService.wallets.set('wallet-1', makeWallet())

    vi.mocked(prisma.aiConfiguration.findUnique).mockResolvedValueOnce({
      id: 'cfg-1',
      key: 'default_model',
      value: 'deepseek-chat',
      updatedAt: new Date(),
    } as never)
    const asString = await buildService(fakes).getSummary('user-1', NOW)
    expect(asString.default_model).toBe('deepseek-chat')

    vi.mocked(prisma.aiConfiguration.findUnique).mockResolvedValueOnce({
      id: 'cfg-1',
      key: 'default_model',
      value: { model: 'deepseek-reasoner' },
      updatedAt: new Date(),
    } as never)
    const asObject = await buildService(fakes).getSummary('user-1', NOW)
    expect(asObject.default_model).toBe('deepseek-reasoner')
  })

  it('defaults to null when the config is missing or unreadable', async () => {
    fakes.walletService.wallets.set('wallet-1', makeWallet())

    const missing = await buildService(fakes).getSummary('user-1', NOW)
    expect(missing.default_model).toBeNull()

    vi.mocked(prisma.aiConfiguration.findUnique).mockRejectedValueOnce(new Error('db down'))
    const broken = await buildService(fakes).getSummary('user-1', NOW)
    expect(broken.default_model).toBeNull()
  })
})
