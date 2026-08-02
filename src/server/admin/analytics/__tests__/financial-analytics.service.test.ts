// ProxyAI — FinancialAnalyticsService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { FinancialAnalyticsService } from '../financial-analytics.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    wallet: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: { aggregate: vi.fn() },
    refundRequest: { aggregate: vi.fn() },
    usageLog: { aggregate: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
/** Loose mock accessor: vi.mock replaces the module at runtime; this cast
 * keeps TypeScript on the vitest Mock surface instead of Prisma's types. */
import type { Mock } from 'vitest'
const mockOf = (target: unknown): Mock => target as unknown as Mock

beforeEach(() => {
  vi.clearAllMocks()

  mockOf(prisma.wallet.aggregate).mockResolvedValue({
    _sum: { balance: new Prisma.Decimal('1000.000000') },
  } as never)
  mockOf(prisma.wallet.findMany).mockResolvedValue([
    { balance: new Prisma.Decimal('-2.500000') },
    { balance: new Prisma.Decimal('-1.000000') },
  ])
  mockOf(prisma.transaction.aggregate).mockResolvedValue({
    _count: { _all: 40 },
    _sum: { amount: new Prisma.Decimal('25.000000') },
  } as never)
  mockOf(prisma.refundRequest.aggregate).mockResolvedValue({
    _count: { _all: 3 },
    _sum: { amount: new Prisma.Decimal('1.500000') },
  } as never)
  mockOf(prisma.usageLog.aggregate).mockResolvedValue({
    _sum: { providerCost: new Prisma.Decimal('8.000000'), userCost: new Prisma.Decimal('25.000000') },
  } as never)
})

describe('FinancialAnalyticsService', () => {
  it('computes wallet float and outstanding negative balance', async () => {
    const service = new FinancialAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.wallet_float).toBe('1000.000000')
    expect(result.negative_balance_users).toBe(2)
    expect(result.outstanding_balance).toBe('3.500000')
  })

  it('computes charges, refunds and topups', async () => {
    const service = new FinancialAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.charges).toEqual({ count: 40, amount: '25.000000' })
    expect(result.refunds).toEqual({ count: 3, amount: '1.500000' })
    expect(result.topups).toEqual({ count: 40, amount: '25.000000' })
  })

  it('computes markup, net revenue and profit estimate', async () => {
    const service = new FinancialAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.provider_cost).toBe('8.000000')
    expect(result.markup_revenue).toBe('17.000000')
    expect(result.net_revenue).toBe('15.500000')
    expect(result.profit_estimate).toBe('15.500000')
  })

  it('returns zeroed values when no data', async () => {
    mockOf(prisma.wallet.aggregate).mockResolvedValue({ _sum: { balance: null } } as never)
    mockOf(prisma.wallet.findMany).mockResolvedValue([])
    mockOf(prisma.usageLog.aggregate).mockResolvedValue({
      _sum: { providerCost: null, userCost: null },
    } as never)
    mockOf(prisma.refundRequest.aggregate).mockResolvedValue({
      _count: { _all: 0 },
      _sum: { amount: null },
    } as never)
    mockOf(prisma.transaction.aggregate).mockResolvedValue({
      _count: { _all: 0 },
      _sum: { amount: null },
    } as never)

    const service = new FinancialAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.wallet_float).toBe('0.000000')
    expect(result.negative_balance_users).toBe(0)
    expect(result.outstanding_balance).toBe('0.000000')
    expect(result.profit_estimate).toBe('0.000000')
  })
})
