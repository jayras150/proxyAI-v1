// ProxyAI — System Monitoring Service (Milestone 4)
// Read-only health checks for the operational dashboard.
// Never throws for a single failed component: each component reports
// its own status so the dashboard stays usable during partial outages.

import { prisma } from '@/lib/prisma'
import { resolveTimeRange, percentString } from './time-range'

export interface ComponentStatus {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'not_configured'
  latency_ms: number | null
  detail: string
}

export interface SystemMonitoring {
  status: 'ok' | 'degraded' | 'down'
  uptime_seconds: number
  environment: string
  version: string
  build_info: {
    node: string
    platform: string
    arch: string
  }
  components: ComponentStatus[]
  requests_per_sec: number
  avg_response_time_ms: number | null
  success_rate: string
  error_rate: string
  checked_at: string
}

export class SystemMonitoringService {
  async getMonitoring(): Promise<SystemMonitoring> {
    const [db, redis, providers, usage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkProviders(),
      this.usageRates(),
    ])

    const components: ComponentStatus[] = [db, redis, ...providers, this.checkQueue(), this.checkStorage(db.status)]

    const overallStatus: SystemMonitoring['status'] = components.some((c) => c.status === 'down')
      ? 'down'
      : components.some((c) => c.status === 'degraded')
        ? 'degraded'
        : 'ok'

    return {
      status: overallStatus,
      uptime_seconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
      version: this.readVersion(),
      build_info: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      components,
      requests_per_sec: usage.requestsPerSec,
      avg_response_time_ms: usage.avgLatencyMs,
      success_rate: percentString(usage.successCount, usage.total),
      error_rate: percentString(usage.errorCount, usage.total),
      checked_at: new Date().toISOString(),
    }
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    const started = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      return {
        name: 'database',
        status: 'ok',
        latency_ms: Date.now() - started,
        detail: 'PostgreSQL reachable',
      }
    } catch {
      return {
        name: 'database',
        status: 'down',
        latency_ms: Date.now() - started,
        detail: 'PostgreSQL unreachable',
      }
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const driver = process.env.RATE_LIMITER_DRIVER ?? 'memory'
    if (driver !== 'redis' || !process.env.UPSTASH_REDIS_REST_URL) {
      return {
        name: 'redis',
        status: 'not_configured',
        latency_ms: null,
        detail: 'Memory rate limiter active (single instance)',
      }
    }
    const started = Date.now()
    try {
      const { Redis } = await import('@upstash/redis')
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
      })
      await redis.ping()
      return {
        name: 'redis',
        status: 'ok',
        latency_ms: Date.now() - started,
        detail: 'Upstash Redis reachable',
      }
    } catch {
      return {
        name: 'redis',
        status: 'down',
        latency_ms: Date.now() - started,
        detail: 'Upstash Redis unreachable',
      }
    }
  }

  private async checkProviders(): Promise<ComponentStatus[]> {
    try {
      const configs = await prisma.aiConfiguration.findMany({
        where: { key: { startsWith: 'provider.' } },
      })
      const providerNames = new Set<string>()
      for (const c of configs) {
        const parts = c.key.split('.')
        if (parts.length >= 2) providerNames.add(parts[1])
      }

      if (providerNames.size === 0) {
        return [
          {
            name: 'providers',
            status: 'not_configured',
            latency_ms: null,
            detail: 'No providers configured',
          },
        ]
      }

      // Derive health from recent usage (last 24h) — no live pings on auto-refresh.
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recent = await prisma.usageLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: dayAgo } },
        _count: { _all: true },
        _sum: { userCost: true },
        _avg: { latencyMs: true },
      })
      const byProvider = new Map(
        recent.map((r) => [r.provider, { total: r._count._all, cost: r._sum.userCost ?? null, avg: r._avg.latencyMs }])
      )

      return Array.from(providerNames).map((name) => {
        const stats = byProvider.get(name)
        if (!stats || stats.total === 0) {
          return {
            name: `provider:${name}`,
            status: 'not_configured' as const,
            latency_ms: null,
            detail: 'No traffic in last 24h',
          }
        }
        return {
          name: `provider:${name}`,
          status: 'ok' as const,
          latency_ms: stats.avg !== null ? Math.round(stats.avg) : null,
          detail: `${stats.total} requests in last 24h`,
        }
      })
    } catch {
      return [
        {
          name: 'providers',
          status: 'degraded',
          latency_ms: null,
          detail: 'Provider config unavailable',
        },
      ]
    }
  }

  private checkQueue(): ComponentStatus {
    return {
      name: 'queue',
      status: 'not_configured',
      latency_ms: null,
      detail: 'In-process event dispatcher (no external queue)',
    }
  }

  private checkStorage(dbStatus: ComponentStatus['status']): ComponentStatus {
    return {
      name: 'storage',
      status: dbStatus === 'ok' ? 'ok' : dbStatus,
      latency_ms: null,
      detail: 'PostgreSQL (Supabase) stores all data',
    }
  }

  private async usageRates(): Promise<{
    total: number
    successCount: number
    errorCount: number
    requestsPerSec: number
    avgLatencyMs: number | null
  }> {
    try {
      const { from } = resolveTimeRange('today')
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

      const [all, lastHour] = await Promise.all([
        prisma.usageLog.groupBy({
          by: ['status'],
          where: { createdAt: { gte: from } },
          _count: { _all: true },
          _avg: { latencyMs: true },
        }),
        prisma.usageLog.count({ where: { createdAt: { gte: hourAgo } } }),
      ])

      const statusMap = new Map(all.map((r) => [r.status, r._count._all]))
      const total = all.reduce((sum, r) => sum + r._count._all, 0)
      const successCount = statusMap.get('COMPLETED') ?? 0
      const errorCount = statusMap.get('FAILED') ?? 0

      const latencies = all.map((r) => r._avg.latencyMs).filter((v): v is number => v !== null)
      const avgLatencyMs = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null

      return {
        total,
        successCount,
        errorCount,
        requestsPerSec: lastHour / 3600,
        avgLatencyMs,
      }
    } catch {
      return { total: 0, successCount: 0, errorCount: 0, requestsPerSec: 0, avgLatencyMs: null }
    }
  }

  private readVersion(): string {
    // npm sets npm_package_version when running via npm scripts.
    return process.env.npm_package_version ?? '0.0.0'
  }
}
