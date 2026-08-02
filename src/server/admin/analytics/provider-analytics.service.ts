// ProxyAI — Provider Analytics Service (Milestone 4)
// Read-only per-provider performance: latency, success/failure rates,
// token usage, estimated cost and health timeline.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTimeRange, percentString, type AnalyticsRange } from './time-range'

export interface ProviderAnalyticsFilters {
  range: AnalyticsRange
  from?: string | null
  to?: string | null
  model?: string | null
  user?: string | null
}

export interface ProviderAnalyticsRow {
  name: string
  display_name: string
  enabled: boolean
  requests: number
  success_count: number
  failure_count: number
  success_rate: string
  timeout_count: number | null
  retry_count: number | null
  avg_latency_ms: number | null
  tokens: number
  estimated_cost: string
  circuit_breaker: {
    enabled: boolean
    failure_threshold: number
    recovery_timeout_ms: number
    status: 'closed' | 'open' | 'half_open' | 'unknown'
  }
  current_status: 'operational' | 'degraded' | 'down' | 'no_traffic'
  health_timeline: Array<{
    date: string
    requests: number
    success_rate: string
  }>
}

export interface ProviderAnalytics {
  range: { from: string; to: string; label: string }
  providers: ProviderAnalyticsRow[]
}

export class ProviderAnalyticsService {
  async getAnalytics(filters: ProviderAnalyticsFilters): Promise<ProviderAnalytics> {
    const range = resolveTimeRange(filters.range, filters.from, filters.to)

    const usageWhere: Prisma.UsageLogWhereInput = {
      createdAt: { gte: range.from, lt: range.to },
    }
    if (filters.model) usageWhere.model = filters.model
    if (filters.user) usageWhere.userId = filters.user

    const [configs, byProvider, byProviderStatus, providerNames, timelineRows] = await Promise.all([
      prisma.aiConfiguration.findMany({
        where: { key: { startsWith: 'provider.' } },
      }),
      prisma.usageLog.groupBy({
        by: ['provider'],
        where: usageWhere,
        _count: { _all: true },
        _sum: { totalTokens: true, providerCost: true },
        _avg: { latencyMs: true },
      }),
      prisma.usageLog.groupBy({
        by: ['provider', 'status'],
        where: usageWhere,
        _count: { _all: true },
      }),
      // Distinct provider names seen in usage
      prisma.usageLog.findMany({
        where: usageWhere,
        select: { provider: true },
        distinct: ['provider'],
      }),
      // Daily per-provider timeline (Postgres date_trunc)
      prisma.$queryRaw<
        Array<{ day: string; provider: string; requests: number; failed: number }>
      >(
        Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          provider,
          COUNT(*)::int AS requests,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
        FROM usage_logs
        WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
        GROUP BY 1, 2 ORDER BY 2, 1`
      ),
    ])

    // Merge provider config (AiConfiguration) into a per-provider map
    const configMap = new Map<string, { enabled: boolean; circuitEnabled: boolean; threshold: number; recovery: number }>()
    const seen = new Set<string>()
    for (const c of configs) {
      const parts = c.key.split('.')
      if (parts.length < 2) continue
      const name = parts[1]
      const field = parts.slice(2).join('.')
      seen.add(name)
      const entry = configMap.get(name) ?? {
        enabled: true,
        circuitEnabled: true,
        threshold: 5,
        recovery: 30000,
      }
      if (field === 'enabled') entry.enabled = Boolean(c.value)
      if (field === 'circuit_breaker.enabled') entry.circuitEnabled = Boolean(c.value)
      if (field === 'circuit_breaker.failure_threshold') entry.threshold = Number(c.value)
      if (field === 'circuit_breaker.recovery_timeout_ms') entry.recovery = Number(c.value)
      configMap.set(name, entry)
    }

    const allNames = new Set<string>([...seen, ...providerNames.map((r) => r.provider)])

    const statsMap = new Map(byProvider.map((r) => [r.provider, r]))
    const statusMap = new Map<string, { total: number; success: number }>()
    for (const row of byProviderStatus) {
      const entry = statusMap.get(row.provider) ?? { total: 0, success: 0 }
      entry.total += row._count._all
      if (row.status === 'COMPLETED') entry.success += row._count._all
      statusMap.set(row.provider, entry)
    }

    // Timeline grouped by provider
    const timelineMap = new Map<string, Map<string, { requests: number; failed: number }>>()
    for (const row of timelineRows) {
      let providerTimeline = timelineMap.get(row.provider)
      if (!providerTimeline) {
        providerTimeline = new Map()
        timelineMap.set(row.provider, providerTimeline)
      }
      providerTimeline.set(row.day, { requests: Number(row.requests), failed: Number(row.failed) })
    }

    const providers: ProviderAnalyticsRow[] = Array.from(allNames).sort().map((name) => {
      const stats = statsMap.get(name)
      const statusStats = statusMap.get(name) ?? { total: 0, success: 0 }
      const config = configMap.get(name)

      const requests = stats?._count?._all ?? 0
      const success = statusStats.success
      const failure = statusStats.total - statusStats.success
      const successRate = percentString(success, statusStats.total)
      const currentStatus: ProviderAnalyticsRow['current_status'] =
        requests === 0
          ? 'no_traffic'
          : failure === 0
            ? 'operational'
            : failure / requests > 0.1
              ? 'down'
              : failure / requests >= 0.05
                ? 'degraded'
                : 'operational'

      const timeline = (timelineMap.get(name) ?? new Map<string, { requests: number; failed: number }>())
      const healthTimeline = Array.from(timeline.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
        date,
        requests: v.requests,
        success_rate: percentString(v.requests - v.failed, v.requests),
      }))

      return {
        name,
        display_name: name.charAt(0).toUpperCase() + name.slice(1),
        enabled: config?.enabled ?? true,
        requests,
        success_count: success,
        failure_count: failure,
        success_rate: successRate,
        // V1 gateway does not persist failure reasons — reported as unknown (null).
        timeout_count: null,
        retry_count: null,
        avg_latency_ms: stats?._avg?.latencyMs !== null && stats?._avg?.latencyMs !== undefined
          ? Math.round(stats._avg.latencyMs)
          : null,
        tokens: stats?._sum?.totalTokens ?? 0,
        estimated_cost: (stats?._sum?.providerCost ?? new Prisma.Decimal(0)).toFixed(6),
        circuit_breaker: {
          enabled: config?.circuitEnabled ?? false,
          failure_threshold: config?.threshold ?? 5,
          recovery_timeout_ms: config?.recovery ?? 30000,
          // No breaker implementation in V1 — always closed when enabled.
          status: config?.circuitEnabled ? 'closed' : 'unknown',
        },
        current_status: currentStatus,
        health_timeline: healthTimeline,
      }
    })

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      providers,
    }
  }
}
