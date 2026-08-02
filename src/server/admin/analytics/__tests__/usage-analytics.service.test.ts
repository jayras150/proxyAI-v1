// ProxyAI — UsageAnalyticsService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { UsageAnalyticsService } from '../usage-analytics.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()

  prisma.usageLog.aggregate.mockResolvedValue({
    _count: { _all: 10 },
    _sum: {
      promptTokens: 5000,
      completionTokens: 3000,
      cachedTokens: 1000,
      totalTokens: 9000,
      providerCost: new Prisma.Decimal('0.100000'),
      userCost: new Prisma.Decimal('0.250000'),
    },
    _avg: { latencyMs: 850 },
  } as never)

  prisma.usageLog.groupBy.mockImplementation((args: { by: string[] }) => {
    if (args.by.length === 2) {
      // provider + status
      return Promise.resolve([
        { provider: 'deepseek', status: 'COMPLETED', _count: { _all: 9 } },
        { provider: 'deepseek', status: 'FAILED', _count: { _all: 1 } },
      ])
    }
    if (args.by[0] === 'model') {
      return Promise.resolve([
        { model: 'deepseek-chat', _count: { _all: 6 }, _sum: { totalTokens: 5000, userCost: new Prisma.Decimal('0.150000') }, _avg: { latencyMs: 800 } },
        { model: 'deepseek-reasoner', _count: { _all: 4 }, _sum: { totalTokens: 4000, userCost: new Prisma.Decimal('0.100000') }, _avg: { latencyMs: 950 } },
      ])
    }
    // provider
    return Promise.resolve([
      { provider: 'deepseek', _count: { _all: 10 }, _sum: { totalTokens: 9000, userCost: new Prisma.Decimal('0.250000') } },
    ])
  })

  prisma.$queryRaw.mockResolvedValue([
    { day: '2026-08-02', requests: 10, tokens: 9000, cost: new Prisma.Decimal('0.250000') },
  ])
})

describe('UsageAnalyticsService', () => {
  it('computes token totals, costs and latency', async () => {
    const service = new UsageAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.totals.requests).toBe(10)
    expect(result.totals.prompt_tokens).toBe(5000)
    expect(result.totals.completion_tokens).toBe(3000)
    expect(result.totals.cached_tokens).toBe(1000)
    expect(result.totals.total_tokens).toBe(9000)
    expect(result.totals.provider_cost).toBe('0.100000')
    expect(result.totals.user_cost).toBe('0.250000')
    expect(result.totals.avg_latency_ms).toBe(850)
    expect(result.totals.avg_cost).toBe('0.025000')
  })

  it('ranks models by request count and includes cost/latency', async () => {
    const service = new UsageAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.by_model[0]).toMatchObject({ model: 'deepseek-chat', requests: 6, tokens: 5000, cost: '0.150000', avg_latency_ms: 800 })
    expect(result.by_model[1]).toMatchObject({ model: 'deepseek-reasoner', requests: 4 })
  })

  it('computes per-provider success rate', async () => {
    const service = new UsageAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.by_provider[0]).toMatchObject({ provider: 'deepseek', requests: 10, tokens: 9000, success_rate: '90.00' })
  })

  it('returns the timeline from raw SQL rows', async () => {
    const service = new UsageAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.timeline).toEqual([
      { date: '2026-08-02', requests: 10, tokens: 9000, cost: '0.250000' },
    ])
  })

  it('returns zeroed totals when there is no data', async () => {
    prisma.usageLog.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, providerCost: new Prisma.Decimal(0), userCost: new Prisma.Decimal(0) },
      _avg: { latencyMs: null },
    } as never)
    prisma.usageLog.groupBy.mockResolvedValue([])
    prisma.$queryRaw.mockResolvedValue([])

    const service = new UsageAnalyticsService()
    const result = await service.getAnalytics({ range: 'today' })

    expect(result.totals.requests).toBe(0)
    expect(result.totals.avg_cost).toBe('0.000000')
    expect(result.totals.avg_latency_ms).toBeNull()
    expect(result.by_model).toEqual([])
  })
})
