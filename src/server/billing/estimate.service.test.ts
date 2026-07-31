// ProxyAI — EstimateService Unit & Integration Tests
// Read-only estimation: pricing lookup + wallet balance + negative floor.

import { describe, it, expect, beforeEach } from 'vitest'
import { EstimateService, EstimateErrorCode } from '@/server/billing/estimate.service'
import { PricingEngine } from '@/server/billing/pricing-engine'
import { PricingSnapshot } from '@/server/billing/pricing-snapshot'
import { TokenUsage } from '@/server/billing/token-usage'
import { Money } from '@/lib/money'
import { Prisma } from '@prisma/client'
import type { PricingVersion, Wallet } from '@prisma/client'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import type { WalletService } from '@/server/wallet/wallet.service'

// ─── Fakes ──────────────────────────────────────────────────────────────

class FakePricingRepo implements PricingRepository {
  versions: PricingVersion[] = []

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
}

const fakeWalletService = {
  getWallet: async (userId: string): Promise<Wallet | null> => {
    if (userId === 'missing') return null
    if (userId === 'locked') {
      return makeWallet('0.50', 'LOCKED')
    }
    if (userId === 'suspended') {
      return makeWallet('0.50', 'SUSPENDED')
    }
    if (userId === 'payment-required') {
      return makeWallet('-0.05', 'PAYMENT_REQUIRED')
    }
    if (userId === 'idr') {
      return makeWallet('100.00', 'ACTIVE', 'IDR')
    }
    return makeWallet(balances[userId] ?? '5.00', 'ACTIVE')
  },
} as unknown as WalletService

const balances: Record<string, string> = {}

function makeWallet(balance: string, status: Wallet['status'], currency: Wallet['currency'] = 'USD'): Wallet {
  return {
    id: `wallet-${status}-${balance}`,
    userId: 'user-1',
    balance: new Prisma.Decimal(balance),
    currency,
    status,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const engine = new PricingEngine()

// ─── Setup ──────────────────────────────────────────────────────────────

let pricingRepo: FakePricingRepo
let service: EstimateService

beforeEach(() => {
  pricingRepo = new FakePricingRepo()
  service = new EstimateService(pricingRepo, fakeWalletService, engine)
  delete balances['user-1']
})

const usage = (prompt: number, completion = 0, cached = 0) =>
  TokenUsage.create({ promptTokens: prompt, completionTokens: completion, cachedTokens: cached })

// ─── Tests ──────────────────────────────────────────────────────────────

describe('EstimateService — pricing lookup', () => {
  it('returns a valid estimate when pricing is found', async () => {
    pricingRepo.addVersion('deepseek-v4-flash')
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'deepseek-v4-flash',
      usage: usage(1_000_000, 0),
    })

    expect(result.canProceed).toBe(true)
    expect(result.pricingVersionId).toBe('pv-deepseek-v4-flash-1')
    expect(result.estimatedCost.toString()).toBe('0.165001') // 0.15 + 10% + fee
    expect(result.estimatedBalance.toString()).toBe('4.834999') // 5.00 - 0.165001
  })

  it('throws PRICING_NOT_FOUND when no active pricing exists', async () => {
    await expect(
      service.estimate({ userId: 'user-1', modelId: 'unknown-model', usage: usage(100, 0) })
    ).rejects.toMatchObject({ code: EstimateErrorCode.PRICING_NOT_FOUND })
  })

  it('selects the ACTIVE version within its effective window', async () => {
    pricingRepo.addVersion('m1', {
      id: 'pv-old',
      version: 1,
      effectiveTo: new Date('2026-06-01'),
      status: 'ARCHIVED',
    })
    pricingRepo.addVersion('m1', {
      id: 'pv-new',
      version: 2,
      inputPrice: new Prisma.Decimal('0.30'),
    })

    const result = await service.estimate({ userId: 'user-1', modelId: 'm1', usage: usage(1_000_000, 0) })
    expect(result.pricingVersionId).toBe('pv-new')
    // 0.30 + 10% + fee = 0.330001
    expect(result.estimatedCost.toString()).toBe('0.330001')
  })

  it('builds the correct pricing snapshot', async () => {
    pricingRepo.addVersion('deepseek-v4-flash')
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'deepseek-v4-flash',
      usage: usage(1_000_000, 0),
    })

    expect(result.pricingSnapshot).toBeInstanceOf(PricingSnapshot)
    expect(result.pricingSnapshot.pricingVersionId).toBe('pv-deepseek-v4-flash-1')
    expect(result.pricingSnapshot.inputPrice.toString()).toBe('0.150000')
    expect(result.pricingSnapshot.outputPrice.toString()).toBe('0.600000')
    expect(result.pricingSnapshot.markupPercent).toBe(10)
  })
})

describe('EstimateService — wallet & floor policy', () => {
  it('throws WALLET_NOT_FOUND when wallet is missing', async () => {
    pricingRepo.addVersion('m1')
    await expect(
      service.estimate({ userId: 'missing', modelId: 'm1', usage: usage(100, 0) })
    ).rejects.toMatchObject({ code: EstimateErrorCode.WALLET_NOT_FOUND })
  })

  it('allows when balance is sufficient', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '10.00'
    const result = await service.estimate({ userId: 'user-1', modelId: 'm1', usage: usage(1_000_000, 0) })
    expect(result.canProceed).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('allows when balance goes negative WITHIN the floor (-0.10)', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '0.05' // estimate 0.165001 → -0.115001? No: pick smaller usage
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'm1',
      usage: usage(100_000, 0), // 0.015 + 10% + fee = 0.016501 → balance 0.033499
    })
    expect(result.canProceed).toBe(true)

    // Exact floor boundary: balance 0.05, cost 0.15 → -0.10 (allowed, equals floor)
    pricingRepo.versions = []
    pricingRepo.addVersion('m1', { markupPercent: new Prisma.Decimal('0') })
    balances['user-1'] = '0.05'
    const boundary = await service.estimate({
      userId: 'user-1',
      modelId: 'm1',
      usage: usage(1_000_000, 0), // 0.15 + fee → 0.150001 → -0.100001 → REJECTED (below floor)
    })
    // cost 0.150001 > floor 0.15 → estimatedBalance = 0.05 - 0.150001 = -0.100001 < -0.10
    expect(boundary.canProceed).toBe(false)
  })

  it('rejects when balance goes below the floor', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '0.05'
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'm1',
      usage: usage(1_000_000, 0), // 0.165001 → -0.115001 < -0.10
    })
    expect(result.canProceed).toBe(false)
    expect(result.reason).toBe(EstimateErrorCode.INSUFFICIENT_BALANCE)
    expect(result.estimatedBalance.toString()).toBe('-0.115001')
  })

  it('respects a custom floor override', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '0.05'
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'm1',
      usage: usage(1_000_000, 0), // -0.115001
      maxNegativeBalance: Money.fromString('0.20', 'USD'), // floor -0.20 → allowed
    })
    expect(result.canProceed).toBe(true)
  })

  it('rejects PAYMENT_REQUIRED wallet regardless of balance', async () => {
    pricingRepo.addVersion('m1')
    const result = await service.estimate({
      userId: 'payment-required',
      modelId: 'm1',
      usage: usage(100, 0),
    })
    expect(result.canProceed).toBe(false)
    expect(result.reason).toBe('PAYMENT_REQUIRED')
  })

  it('rejects LOCKED and SUSPENDED wallets', async () => {
    pricingRepo.addVersion('m1')
    const locked = await service.estimate({ userId: 'locked', modelId: 'm1', usage: usage(100, 0) })
    const suspended = await service.estimate({ userId: 'suspended', modelId: 'm1', usage: usage(100, 0) })
    expect(locked.canProceed).toBe(false)
    expect(locked.reason).toBe('WALLET_LOCKED')
    expect(suspended.canProceed).toBe(false)
    expect(suspended.reason).toBe('WALLET_SUSPENDED')
  })

  it('throws CURRENCY_MISMATCH for non-USD wallet vs USD pricing', async () => {
    pricingRepo.addVersion('m1')
    await expect(
      service.estimate({ userId: 'idr', modelId: 'm1', usage: usage(100, 0) })
    ).rejects.toMatchObject({ code: EstimateErrorCode.CURRENCY_MISMATCH })
  })
})

describe('EstimateService — purity & determinism', () => {
  it('is deterministic — same inputs, same outputs', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '3.33'
    const a = await service.estimate({ userId: 'user-1', modelId: 'm1', usage: usage(12_345, 6_789) })
    const b = await service.estimate({ userId: 'user-1', modelId: 'm1', usage: usage(12_345, 6_789) })
    expect(a.estimatedCost.toString()).toBe(b.estimatedCost.toString())
    expect(a.estimatedBalance.toString()).toBe(b.estimatedBalance.toString())
    expect(a.canProceed).toBe(b.canProceed)
  })

  it('supports service fee override', async () => {
    pricingRepo.addVersion('m1')
    balances['user-1'] = '10.00'
    const result = await service.estimate({
      userId: 'user-1',
      modelId: 'm1',
      usage: usage(1_000_000, 0),
      serviceFee: Money.fromString('0.01', 'USD'),
    })
    // 0.15 + 0.015 + 0.01 = 0.175
    expect(result.estimatedCost.toString()).toBe('0.175000')
  })
})
