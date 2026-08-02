// ProxyAI — AI Usage Analytics Service (Milestone 4)
// Read-only token & latency analytics across models and providers.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTimeRange, percentString, type AnalyticsRange } from './time-range'

export interface UsageAnalyticsFilters {
  range: AnalyticsRange
  from?: string | null
  to?: string | null
  provider?: string | null
  model?: string | null
  user?: string | null
}

export interface UsageAnalytics {
  range: { from: string; to: string; label: string }
  totals: {
    requests: number
    prompt_tokens: number
    completion_tokens: number
    cached_tokens: number
    total_tokens: number
    provider_cost: string
    user_cost: string
    avg_latency_ms: number | null
    avg_cost: string
  }
  by_model: Array<{
    model: string
    requests: number
    tokens: number
    cost: string
    avg_latency_ms: number | null
  }>
  by_provider: Array<{
    provider: string
    requests: number
    tokens: number
    cost: string
    success_rate: string
  }>
  timeline: Array<{
    date: string
    requests: number
    tokens: number
    cost: string
  }>
}

// Prisma types groupBy `_count` as `true | {...}` unions; these helpers
// normalize the aggregate access without casting at every call site.
interface GroupRowLike {
  _count?: unknown
  _sum?: unknown
  _avg?: unknown
}

function groupCount(row: GroupRowLike): number {
  const c = row._count
  return c && typeof c === 'object' ? ((c as { _all?: number })._all ?? 0) : 0
}

function groupSum(row: GroupRowLike, key: 'totalTokens' | 'userCost'): number {
  const s = row._sum
  if (s && typeof s === 'object') {
    const val = (s as { totalTokens?: number; userCost?: Prisma.Decimal })[key]
    return typeof val === 'number' ? val : 0
  }
  return 0
}

function groupCost(row: GroupRowLike): Prisma.Decimal | null {
  const s = row._sum
  if (s && typeof s === 'object') {
    const val = (s as { userCost?: Prisma.Decimal }).userCost
    return val ?? null
  }
  return null
}

function groupAvg(row: GroupRowLike): number | null {
  const a = row._avg
  if (a && typeof a === 'object') {
    const val = (a as { latencyMs?: number | null }).latencyMs
    return val !== null && val !== undefined ? Math.round(val) : null
  }
  return null
}

export class UsageAnalyticsService {
  async getAnalytics(filters: UsageAnalyticsFilters): Promise<UsageAnalytics> {
    const range = resolveTimeRange(filters.range, filters.from, filters.to)

    const where: Prisma.UsageLogWhereInput = {
      createdAt: { gte: range.from, lt: range.to },
    }
    if (filters.provider) where.provider = filters.provider
    if (filters.model) where.model = filters.model
    if (filters.user) where.userId = filters.user

    const [totals, byModel, byProvider, byStatus, timelineRows] = await Promise.all([
      prisma.usageLog.aggregate({
        where,
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, cachedTokens: true, totalTokens: true, providerCost: true, userCost: true },
        _avg: { latencyMs: true },
      }),
      prisma.usageLog.groupBy({
        by: ['model'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true, userCost: true },
        _avg: { latencyMs: true },
        orderBy: { _sum: { userCost: 'desc' as const } },
        take: 50,
      }),
      prisma.usageLog.groupBy({
        by: ['provider'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true, userCost: true },
        orderBy: { _sum: { userCost: 'desc' as const } },
        take: 50,
      }),
      prisma.usageLog.groupBy({
        by: ['provider', 'status'],
        where,
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ day: string; requests: number; tokens: number; cost: Prisma.Decimal }>>(
        Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS requests,
          COALESCE(SUM("totalTokens"), 0)::int AS tokens,
          COALESCE(SUM("userCost"), 0) AS cost
        FROM usage_logs
        WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
        GROUP BY 1 ORDER BY 1`
      ),
    ])

    // Provider success rates
    const providerStatus = new Map<string, { total: number; success: number }>()
    for (const row of byStatus) {
      const entry = providerStatus.get(row.provider) ?? { total: 0, success: 0 }
      entry.total += groupCount(row)
      if (row.status === 'COMPLETED') entry.success += groupCount(row)
      providerStatus.set(row.provider, entry)
    }

    const requests = totals._count._all
    const avgCost = requests > 0
      ? (totals._sum.userCost ?? new Prisma.Decimal(0)).div(requests).toFixed(6)
      : '0.000000'

    // Sort + truncate in JS (groupBy orderBy on aggregates is not reliable)
    const topModels = [...byModel].sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0)).slice(0, 10)
    const topProviders = [...byProvider].sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0)).slice(0, 10)

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      totals: {
        requests,
        prompt_tokens: totals._sum.promptTokens ?? 0,
        completion_tokens: totals._sum.completionTokens ?? 0,
        cached_tokens: totals._sum.cachedTokens ?? 0,
        total_tokens: totals._sum.totalTokens ?? 0,
        provider_cost: (totals._sum.providerCost ?? new Prisma.Decimal(0)).toFixed(6),
        user_cost: (totals._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
        avg_latency_ms: totals._avg.latencyMs !== null && totals._avg.latencyMs !== undefined ? Math.round(totals._avg.latencyMs) : null,
        avg_cost: avgCost,
      },
      by_model: topModels.map((r) => ({
        model: r.model,
        requests: groupCount(r),
        tokens: groupSum(r, 'totalTokens'),
        cost: (groupCost(r) ?? new Prisma.Decimal(0)).toFixed(6),
        avg_latency_ms: groupAvg(r),
      })),
      by_provider: topProviders.map((r) => {
        const stats = providerStatus.get(r.provider) ?? { total: 0, success: 0 }
        return {
          provider: r.provider,
          requests: groupCount(r),
          tokens: groupSum(r, 'totalTokens'),
          cost: (groupCost(r) ?? new Prisma.Decimal(0)).toFixed(6),
          success_rate: percentString(stats.success, stats.total),
        }
      }),
      timeline: timelineRows.map((r) => ({
        date: r.day,
        requests: Number(r.requests),
        tokens: Number(r.tokens),
        cost: (r.cost ?? new Prisma.Decimal(0)).toFixed(6),
      })),
    }
  }
}
