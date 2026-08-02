// ProxyAI — Business Analytics Service (Milestone 4)
// Read-only revenue & user metrics. Aggregates from usage logs,
// users, transactions and refund requests.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTimeRange, dayBuckets, percentString, type AnalyticsRange } from './time-range'

export interface BusinessAnalyticsFilters {
  range: AnalyticsRange
  from?: string | null
  to?: string | null
  provider?: string | null
  model?: string | null
  user?: string | null
}

export interface BusinessAnalytics {
  range: { from: string; to: string; label: string }
  revenue: {
    today: string
    yesterday: string
    month: string
    growth_percent: string
  }
  users: {
    active: number
    new: number
    returning: number
  }
  api_requests: {
    total: number
    success: number
    error: number
    success_rate: string
  }
  wallet: {
    topups_count: number
    topups_amount: string
    refunds_count: number
    refunds_amount: string
  }
  arpu: string
  top_users: Array<{
    user_id: string
    email: string
    requests: number
    spend: string
  }>
  timeline: Array<{
    date: string
    requests: number
    revenue: string
  }>
}

const DAY_MS = 24 * 60 * 60 * 1000

export class BusinessAnalyticsService {
  async getAnalytics(filters: BusinessAnalyticsFilters): Promise<BusinessAnalytics> {
    const range = resolveTimeRange(filters.range, filters.from, filters.to)

    const scopedWhere: Prisma.UsageLogWhereInput = {
      createdAt: { gte: range.from, lt: range.to },
    }
    if (filters.provider) scopedWhere.provider = filters.provider
    if (filters.model) scopedWhere.model = filters.model
    if (filters.user) scopedWhere.userId = filters.user

    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS)
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const periodWhere = (gte: Date, lt: Date): Prisma.UsageLogWhereInput => {
      const w: Prisma.UsageLogWhereInput = { createdAt: { gte, lt } }
      if (filters.provider) w.provider = filters.provider
      if (filters.model) w.model = filters.model
      if (filters.user) w.userId = filters.user
      return w
    }

    const [
      usageAgg,
      usageByStatus,
      usageByUser,
      activeUserRows,
      timelineRows,
      newUsers,
      todayAgg,
      yesterdayAgg,
      monthAgg,
      topupsAgg,
      refundsAgg,
    ] = await Promise.all([
      // Window aggregate (completed spend)
      prisma.usageLog.aggregate({
        where: { ...scopedWhere, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { userCost: true },
      }),
      // Window status breakdown (all statuses)
      prisma.usageLog.groupBy({
        by: ['status'],
        where: scopedWhere,
        _count: { _all: true },
      }),
      // Per-user spend (top users)
      prisma.usageLog.groupBy({
        by: ['userId'],
        where: { ...scopedWhere, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { userCost: true },
        orderBy: { _sum: { userCost: 'desc' as const } },
        take: 50,
      }),
      // Distinct active users in window
      prisma.usageLog.groupBy({
        by: ['userId'],
        where: scopedWhere,
        _count: { _all: true },
      }),
      // Daily buckets (Postgres date_trunc)
      prisma.$queryRaw<Array<{ day: string; requests: number; revenue: Prisma.Decimal }>>(
        Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS requests,
          COALESCE(SUM("userCost"), 0) AS revenue
        FROM usage_logs
        WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to} AND status = 'COMPLETED'
        GROUP BY 1 ORDER BY 1`
      ),
      // New users in window
      prisma.user.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      // Today revenue (filtered)
      prisma.usageLog.aggregate({
        where: { ...periodWhere(startOfToday, now), status: 'COMPLETED' },
        _sum: { userCost: true },
      }),
      // Yesterday revenue (filtered)
      prisma.usageLog.aggregate({
        where: { ...periodWhere(startOfYesterday, startOfToday), status: 'COMPLETED' },
        _sum: { userCost: true },
      }),
      // Month revenue (filtered, from month start to now)
      prisma.usageLog.aggregate({
        where: { ...periodWhere(startOfMonth, now), status: 'COMPLETED' },
        _sum: { userCost: true },
      }),
      // Topups in window
      prisma.transaction.aggregate({
        where: { type: 'TOPUP', status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Refunds in window
      prisma.refundRequest.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ])

    const statusMap = new Map(usageByStatus.map((r) => [r.status, r._count._all]))
    const totalRequests = usageByStatus.reduce((sum, r) => sum + r._count._all, 0)
    const successCount = statusMap.get('COMPLETED') ?? 0
    const errorCount = statusMap.get('FAILED') ?? 0

    const topUsers = [...usageByUser].sort((a, b) => {
      const aCost = a._sum?.userCost ?? new Prisma.Decimal(0)
      const bCost = b._sum?.userCost ?? new Prisma.Decimal(0)
      return bCost.minus(aCost).toNumber()
    }).slice(0, 10)

    const activeUsers = activeUserRows.length
    const revenueWindow = usageAgg._sum.userCost ?? new Prisma.Decimal(0)
    const yesterdayRevenue = yesterdayAgg._sum.userCost ?? new Prisma.Decimal(0)

    const growth = yesterdayRevenue.isZero()
      ? '0.00'
      : revenueWindow.minus(yesterdayRevenue).div(yesterdayRevenue).mul(100).toFixed(2)

    // Daily timeline — fill missing days with zeros
    const timelineMap = new Map<string, { requests: number; revenue: Prisma.Decimal }>()
    for (const bucket of dayBuckets(range.from, range.to)) {
      timelineMap.set(bucket, { requests: 0, revenue: new Prisma.Decimal(0) })
    }
    for (const row of timelineRows) {
      const entry = timelineMap.get(row.day)
      if (entry) {
        entry.requests += Number(row.requests)
        entry.revenue = entry.revenue.plus(row.revenue ?? 0)
      }
    }

    const arpu = activeUsers > 0 ? revenueWindow.div(activeUsers).toFixed(6) : '0.000000'

    // Resolve top user emails
    const userIds = topUsers.map((u) => u.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : []
    const emailMap = new Map(users.map((u) => [u.id, u.email]))

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      revenue: {
        today: (todayAgg._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
        yesterday: yesterdayRevenue.toFixed(6),
        month: (monthAgg._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
        growth_percent: growth,
      },
      users: {
        active: activeUsers,
        new: newUsers,
        returning: Math.max(0, activeUsers - newUsers),
      },
      api_requests: {
        total: totalRequests,
        success: successCount,
        error: errorCount,
        success_rate: percentString(successCount, totalRequests),
      },
      wallet: {
        topups_count: topupsAgg._count._all,
        topups_amount: (topupsAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(6),
        refunds_count: refundsAgg._count._all,
        refunds_amount: (refundsAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(6),
      },
      arpu,
      top_users: topUsers.map((u) => ({
        user_id: u.userId,
        email: emailMap.get(u.userId) ?? 'unknown',
        requests: u._count?._all ?? 0,
        spend: (u._sum?.userCost ?? new Prisma.Decimal(0)).toFixed(6),
      })),
      timeline: Array.from(timelineMap.entries()).map(([date, v]) => ({
        date,
        requests: v.requests,
        revenue: v.revenue.toFixed(6),
      })),
    }
  }
}
