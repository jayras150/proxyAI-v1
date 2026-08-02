// ProxyAI — BusinessAnalyticsService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { BusinessAnalyticsService } from '../business-analytics.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: { aggregate: vi.fn() },
    refundRequest: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
/** Loose mock accessor: vi.mock replaces the module at runtime; this cast
 * keeps TypeScript on the vitest Mock surface instead of Prisma's types. */
import type { Mock } from 'vitest'
const mockOf = (target: unknown): Mock => target as unknown as Mock

const BASE_FILTERS = { range: 'today' as const }

beforeEach(() => {
  vi.clearAllMocks()

  // usageLog.aggregate — used 4× (window, today, yesterday, month)
  mockOf(prisma.usageLog.aggregate).mockResolvedValue({
    _count: { _all: 10 },
    _sum: { userCost: new Prisma.Decimal('5.000000') },
  } as never)

  // usageLog.groupBy — status breakdown, top users, active users
  mockOf(prisma.usageLog.groupBy).mockImplementation((args: { by: string[]; _count?: boolean }) => {
    if (args.by[0] === 'status') {
      return Promise.resolve([
        { status: 'COMPLETED', _count: { _all: 8 } },
        { status: 'FAILED', _count: { _all: 2 } },
      ])
    }
    // userId groups
    return Promise.resolve([
      { userId: 'user-1', _count: { _all: 6 }, _sum: { userCost: new Prisma.Decimal('4.000000') } },
      { userId: 'user-2', _count: { _all: 4 }, _sum: { userCost: new Prisma.Decimal('1.000000') } },
    ])
  })

  mockOf(prisma.user.count).mockResolvedValue(3)
  mockOf(prisma.user.findMany).mockResolvedValue([
    { id: 'user-1', email: 'alice@test.com' },
    { id: 'user-2', email: 'bob@test.com' },
  ])
  mockOf(prisma.transaction.aggregate).mockResolvedValue({
    _count: { _all: 2 },
    _sum: { amount: new Prisma.Decimal('20.000000') },
  } as never)
  mockOf(prisma.refundRequest.aggregate).mockResolvedValue({
    _count: { _all: 1 },
    _sum: { amount: new Prisma.Decimal('0.500000') },
  } as never)
  mockOf(prisma.$queryRaw).mockResolvedValue([
    { day: '2026-08-02', requests: 10, revenue: new Prisma.Decimal('5.000000') },
  ])
})

describe('BusinessAnalyticsService', () => {
  it('computes revenue, users, requests and wallet metrics', async () => {
    const service = new BusinessAnalyticsService()
    const result = await service.getAnalytics(BASE_FILTERS)

    expect(result.revenue.today).toBe('5.000000')
    expect(result.revenue.yesterday).toBe('5.000000')
    expect(result.users.active).toBe(2)
    expect(result.users.new).toBe(3)
    expect(result.api_requests.total).toBe(10)
    expect(result.api_requests.success).toBe(8)
    expect(result.api_requests.success_rate).toBe('80.00')
    expect(result.wallet.topups_count).toBe(2)
    expect(result.wallet.topups_amount).toBe('20.000000')
    expect(result.wallet.refunds_count).toBe(1)
    expect(result.arpu).toBe('2.500000')
  })

  it('lists top users with resolved emails sorted by spend', async () => {
    const service = new BusinessAnalyticsService()
    const result = await service.getAnalytics(BASE_FILTERS)

    expect(result.top_users).toHaveLength(2)
    expect(result.top_users[0]).toMatchObject({ email: 'alice@test.com', requests: 6, spend: '4.000000' })
    expect(result.top_users[1]).toMatchObject({ email: 'bob@test.com', requests: 4, spend: '1.000000' })
  })

  it('builds a daily timeline, zero-filling missing days', async () => {
    mockOf(prisma.$queryRaw).mockResolvedValue([
      { day: '2026-08-02', requests: 6, revenue: new Prisma.Decimal('3.000000') },
    ])
    const service = new BusinessAnalyticsService()
    const result = await service.getAnalytics({ ...BASE_FILTERS, from: '2026-08-01', to: '2026-08-04', range: 'custom' })

    // to is exclusive — buckets cover 01, 02, 03
    expect(result.timeline.map((t) => t.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
    const day2 = result.timeline.find((t) => t.date === '2026-08-02')
    expect(day2).toMatchObject({ requests: 6, revenue: '3.000000' })
    const day1 = result.timeline.find((t) => t.date === '2026-08-01')
    expect(day1).toMatchObject({ requests: 0, revenue: '0.000000' })
  })

  it('passes provider/model/user filters into queries', async () => {
    const service = new BusinessAnalyticsService()
    await service.getAnalytics({
      range: '7d',
      provider: 'deepseek',
      model: 'deepseek-chat',
      user: 'user-1',
    })

    const usageAggCalls = mockOf(prisma.usageLog.aggregate).mock.calls
    expect(usageAggCalls.length).toBeGreaterThan(0)
    const first = usageAggCalls[0][0]
    expect(first.where.provider).toBe('deepseek')
    expect(first.where.model).toBe('deepseek-chat')
    expect(first.where.userId).toBe('user-1')
  })

  it('returns zeroed metrics when there is no data', async () => {
    mockOf(prisma.usageLog.groupBy).mockResolvedValue([])
    mockOf(prisma.usageLog.aggregate).mockResolvedValue({
      _count: { _all: 0 },
      _sum: { userCost: new Prisma.Decimal(0) },
    } as never)
    mockOf(prisma.$queryRaw).mockResolvedValue([])

    const service = new BusinessAnalyticsService()
    const result = await service.getAnalytics(BASE_FILTERS)

    expect(result.revenue.today).toBe('0.000000')
    expect(result.users.active).toBe(0)
    expect(result.api_requests.success_rate).toBe('0.00')
    expect(result.arpu).toBe('0.000000')
    expect(result.top_users).toEqual([])
  })
})
