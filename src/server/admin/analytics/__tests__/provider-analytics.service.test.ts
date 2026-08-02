// ProxyAI — ProviderAnalyticsService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { ProviderAnalyticsService } from '../provider-analytics.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiConfiguration: { findMany: vi.fn() },
    usageLog: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()

  prisma.aiConfiguration.findMany.mockResolvedValue([
    { key: 'provider.deepseek.enabled', value: true },
    { key: 'provider.deepseek.circuit_breaker.enabled', value: true },
    { key: 'provider.deepseek.circuit_breaker.failure_threshold', value: 5 },
    { key: 'provider.deepseek.circuit_breaker.recovery_timeout_ms', value: 30000 },
  ])

  prisma.usageLog.groupBy.mockImplementation((args: { by: string[] }) => {
    if (args.by.length === 2) {
      // provider + status
      return Promise.resolve([
        { provider: 'deepseek', status: 'COMPLETED', _count: { _all: 97 } },
        { provider: 'deepseek', status: 'FAILED', _count: { _all: 3 } },
      ])
    }
    // provider
    return Promise.resolve([
      { provider: 'deepseek', _count: { _all: 100 }, _sum: { totalTokens: 90000, providerCost: new Prisma.Decimal('2.000000') }, _avg: { latencyMs: 420 } },
    ])
  })

  prisma.usageLog.findMany.mockResolvedValue([
    { provider: 'deepseek' },
    { provider: 'deepseek' },
  ])

  prisma.$queryRaw.mockResolvedValue([
    { day: '2026-08-01', provider: 'deepseek', requests: 40, failed: 1 },
    { day: '2026-08-02', provider: 'deepseek', requests: 60, failed: 2 },
  ])
})

describe('ProviderAnalyticsService', () => {
  it('computes per-provider stats with success rate and cost', async () => {
    const service = new ProviderAnalyticsService()
    const result = await service.getAnalytics({ range: '7d' })

    expect(result.providers).toHaveLength(1)
    const p = result.providers[0]
    expect(p.name).toBe('deepseek')
    expect(p.requests).toBe(100)
    expect(p.success_count).toBe(97)
    expect(p.failure_count).toBe(3)
    expect(p.success_rate).toBe('97.00')
    expect(p.avg_latency_ms).toBe(420)
    expect(p.tokens).toBe(90000)
    expect(p.estimated_cost).toBe('2.000000')
    expect(p.current_status).toBe('operational')
  })

  it('reads circuit breaker config from AiConfiguration', async () => {
    const service = new ProviderAnalyticsService()
    const result = await service.getAnalytics({ range: '7d' })

    expect(result.providers[0].circuit_breaker).toEqual({
      enabled: true,
      failure_threshold: 5,
      recovery_timeout_ms: 30000,
      status: 'closed',
    })
  })

  it('builds a per-day health timeline', async () => {
    const service = new ProviderAnalyticsService()
    const result = await service.getAnalytics({ range: '7d' })

    const timeline = result.providers[0].health_timeline
    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({ date: '2026-08-01', requests: 40, success_rate: '97.50' })
    expect(timeline[1]).toMatchObject({ date: '2026-08-02', requests: 60, success_rate: '96.67' })
  })

  it('marks provider degraded when failure rate exceeds 5%', async () => {
    prisma.usageLog.groupBy.mockImplementation((args: { by: string[] }) => {
      if (args.by.length === 2) {
        return Promise.resolve([
          { provider: 'deepseek', status: 'COMPLETED', _count: { _all: 90 } },
          { provider: 'deepseek', status: 'FAILED', _count: { _all: 10 } },
        ])
      }
      return Promise.resolve([
        { provider: 'deepseek', _count: { _all: 100 }, _sum: { totalTokens: 0, providerCost: new Prisma.Decimal(0) }, _avg: { latencyMs: null } },
      ])
    })

    const service = new ProviderAnalyticsService()
    const result = await service.getAnalytics({ range: '7d' })

    expect(result.providers[0].current_status).toBe('degraded')
    expect(result.providers[0].success_rate).toBe('90.00')
  })

  it('marks provider no_traffic when there are no requests', async () => {
    prisma.usageLog.groupBy.mockResolvedValue([])
    prisma.usageLog.findMany.mockResolvedValue([])
    prisma.$queryRaw.mockResolvedValue([])

    const service = new ProviderAnalyticsService()
    const result = await service.getAnalytics({ range: '7d' })

    expect(result.providers[0].current_status).toBe('no_traffic')
    expect(result.providers[0].requests).toBe(0)
  })
})
