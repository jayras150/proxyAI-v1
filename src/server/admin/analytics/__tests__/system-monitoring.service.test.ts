// ProxyAI — SystemMonitoringService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { SystemMonitoringService } from '../system-monitoring.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    aiConfiguration: { findMany: vi.fn() },
    usageLog: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()

  prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
  prisma.aiConfiguration.findMany.mockResolvedValue([
    { key: 'provider.deepseek.enabled', value: true },
    { key: 'provider.deepseek.base_url', value: 'https://api.deepseek.com' },
  ])

  prisma.usageLog.groupBy.mockImplementation((args: { by: string[] }) => {
    if (args.by[0] === 'status') {
      return Promise.resolve([
        { status: 'COMPLETED', _count: { _all: 90 }, _avg: { latencyMs: 400 } },
        { status: 'FAILED', _count: { _all: 10 }, _avg: { latencyMs: 500 } },
      ])
    }
    return Promise.resolve([
      { provider: 'deepseek', _count: { _all: 50 }, _sum: { userCost: new Prisma.Decimal(0) }, _avg: { latencyMs: 400 } },
    ])
  })
  prisma.usageLog.count.mockResolvedValue(3600)
})

describe('SystemMonitoringService', () => {
  it('reports ok status when all components are healthy', async () => {
    const service = new SystemMonitoringService()
    const result = await service.getMonitoring()

    expect(result.status).toBe('ok')
    expect(result.components.find((c) => c.name === 'database')?.status).toBe('ok')
    expect(result.components.find((c) => c.name === 'redis')?.status).toBe('not_configured')
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0)
    expect(result.environment).toBeTruthy()
  })

  it('computes success/error rates and requests per second', async () => {
    const service = new SystemMonitoringService()
    const result = await service.getMonitoring()

    expect(result.success_rate).toBe('90.00')
    expect(result.error_rate).toBe('10.00')
    expect(result.requests_per_sec).toBe(1) // 3600 / 3600
    expect(result.avg_response_time_ms).toBe(450)
  })

  it('reports down status when the database check fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'))

    const service = new SystemMonitoringService()
    const result = await service.getMonitoring()

    expect(result.status).toBe('down')
    expect(result.components.find((c) => c.name === 'database')?.status).toBe('down')
    // Storage follows DB status
    expect(result.components.find((c) => c.name === 'storage')?.status).toBe('down')
  })

  it('reports providers as not_configured when none exist', async () => {
    prisma.aiConfiguration.findMany.mockResolvedValue([])

    const service = new SystemMonitoringService()
    const result = await service.getMonitoring()

    expect(result.components.find((c) => c.name === 'providers')?.status).toBe('not_configured')
  })

  it('includes version, build info and queue/storage components', async () => {
    const service = new SystemMonitoringService()
    const result = await service.getMonitoring()

    expect(result.version).toBeTruthy()
    expect(result.build_info.node).toBeTruthy()
    expect(result.components.map((c) => c.name)).toEqual(
      expect.arrayContaining(['database', 'redis', 'queue', 'storage'])
    )
  })
})
