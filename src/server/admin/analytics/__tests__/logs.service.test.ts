// ProxyAI — LogsService unit tests (Prisma mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { LogsService } from '../logs.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    refundRequest: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
/** Loose mock accessor: vi.mock replaces the module at runtime; this cast
 * keeps TypeScript on the vitest Mock surface instead of Prisma's types. */
import type { Mock } from 'vitest'
const mockOf = (target: unknown): Mock => target as unknown as Mock

function usageRow(id: string, status: 'COMPLETED' | 'FAILED', createdAt: Date) {
  return {
    id,
    userId: 'user-1',
    model: 'deepseek-chat',
    provider: 'deepseek',
    totalTokens: 150,
    requestId: 'req_123',
    status,
    createdAt,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LogsService', () => {
  it('returns error entries from FAILED usage logs', async () => {
    mockOf(prisma.usageLog.findMany).mockResolvedValue([usageRow('u1', 'FAILED', new Date('2026-08-02T10:00:00.000Z'))])

    const service = new LogsService()
    const page = await service.list({ type: 'error' })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      type: 'error',
      title: 'deepseek-chat · deepseek',
      detail: '150 tokens · req_123',
      user_id: 'user-1',
    })
  })

  it('returns admin actions from the audit log', async () => {
    mockOf(prisma.auditLog.findMany).mockResolvedValue([
      { id: 'a1', adminId: 'admin-1', action: 'model.created', resource: 'model:m1', createdAt: new Date('2026-08-02T11:00:00.000Z') },
    ])

    const service = new LogsService()
    const page = await service.list({ type: 'admin_action' })

    expect(page.items[0]).toMatchObject({ type: 'admin_action', title: 'model.created', detail: 'model:m1', admin_id: 'admin-1' })
  })

  it('merges all sources sorted newest-first when no type is given', async () => {
    mockOf(prisma.usageLog.findMany).mockResolvedValue([usageRow('u1', 'COMPLETED', new Date('2026-08-02T10:00:00.000Z'))])
    mockOf(prisma.auditLog.findMany).mockResolvedValue([
      { id: 'a1', adminId: 'admin-1', action: 'user.suspended', resource: 'user:u9', createdAt: new Date('2026-08-02T12:00:00.000Z') },
    ])
    mockOf(prisma.refundRequest.findMany).mockResolvedValue([
      { id: 'r1', userId: 'user-1', status: 'COMPLETED', amount: new Prisma.Decimal('0.500000'), currency: 'USD', createdAt: new Date('2026-08-02T09:00:00.000Z') },
    ])
    mockOf(prisma.transaction.findMany).mockResolvedValue([
      { id: 't1', userId: 'user-1', type: 'TOPUP', status: 'COMPLETED', amount: new Prisma.Decimal('10.000000'), currency: 'USD', createdAt: new Date('2026-08-02T08:00:00.000Z') },
    ])

    const service = new LogsService()
    const page = await service.list({ limit: 10 })

    // error and request share the same usage row (mock returns it for both)
    expect(page.items.map((i) => i.type)).toEqual(['admin_action', 'error', 'request', 'refund', 'wallet'])
  })

  it('paginates with an opaque cursor and has_more flag', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => usageRow(`u${i}`, 'COMPLETED', new Date(Date.UTC(2026, 7, 2, 10, i))))

    mockOf(prisma.usageLog.findMany).mockResolvedValue(rows)

    const service = new LogsService()
    const page = await service.list({ type: 'request', limit: 20 })

    expect(page.items).toHaveLength(20)
    expect(page.has_more).toBe(true)
    expect(page.next_cursor).toBeTruthy()

    // Cursor filters to earlier entries
    mockOf(prisma.usageLog.findMany).mockResolvedValue(rows.slice(20))
    const page2 = await service.list({ type: 'request', limit: 20, cursor: page.next_cursor ?? undefined })
    expect(page2.items).toHaveLength(1)
    expect(page2.has_more).toBe(false)
    expect(page2.next_cursor).toBeNull()
  })

  it('caps limit between 1 and 100', async () => {
    mockOf(prisma.usageLog.findMany).mockResolvedValue([])
    const service = new LogsService()

    await service.list({ type: 'request', limit: 0 })
    expect(prisma.usageLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }) // max(1, 0)+1
    )

    await service.list({ type: 'request', limit: 500 })
    expect(prisma.usageLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 })
    )
  })
})
