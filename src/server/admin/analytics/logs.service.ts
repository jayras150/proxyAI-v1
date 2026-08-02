// ProxyAI — Logs Viewer Service (Milestone 4)
// Read-only unified log stream: errors, requests, admin actions,
// refunds and wallet actions with cursor pagination.

import { prisma } from '@/lib/prisma'

export type LogType = 'error' | 'request' | 'admin_action' | 'refund' | 'wallet'

export interface LogEntry {
  id: string
  type: LogType
  title: string
  detail: string | null
  user_id: string | null
  admin_id: string | null
  created_at: string
}

export interface LogsPage {
  items: LogEntry[]
  next_cursor: string | null
  has_more: boolean
}

interface RawLog {
  id: string
  type: LogType
  title: string
  detail: string | null
  userId: string | null
  adminId: string | null
  createdAt: Date
}

const SOURCES: LogType[] = ['error', 'request', 'admin_action', 'refund', 'wallet']

export class LogsService {
  /**
   * Fetch recent log entries. `type` filters to a single source;
   * omitted type merges all sources sorted by time (newest first).
   */
  async list(params: { type?: string; cursor?: string; limit?: number }): Promise<LogsPage> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const createdBefore = this.cursorDate(params.cursor)

    if (params.type && this.isLogType(params.type)) {
      const rows = await this.fetchSingle(params.type, createdBefore, limit + 1)
      return this.paginate(rows, limit)
    }

    const results = await Promise.all(
      SOURCES.map((type) => this.fetchSingle(type, createdBefore, limit + 1))
    )

    const merged = results
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id))

    return this.paginate(merged, limit)
  }

  private async fetchSingle(
    type: LogType,
    createdBefore: Date | null,
    take: number
  ): Promise<RawLog[]> {
    const where = createdBefore ? { createdAt: { lt: createdBefore } } : undefined

    switch (type) {
      case 'error':
        return this.mapUsage(
          await prisma.usageLog.findMany({
            where: { status: 'FAILED', ...(where ?? {}) },
            orderBy: { createdAt: 'desc' },
            take,
          }),
          'error'
        )
      case 'request':
        return this.mapUsage(
          await prisma.usageLog.findMany({
            where: { status: 'COMPLETED', ...(where ?? {}) },
            orderBy: { createdAt: 'desc' },
            take,
          }),
          'request'
        )
      case 'admin_action':
        return (
          await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take })
        ).map((a) => ({
          id: `admin:${a.id}`,
          type: 'admin_action' as const,
          title: a.action,
          detail: a.resource,
          userId: null,
          adminId: a.adminId,
          createdAt: a.createdAt,
        }))
      case 'refund':
        return (
          await prisma.refundRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take })
        ).map((r) => ({
          id: `refund:${r.id}`,
          type: 'refund' as const,
          title: `${r.status} refund`,
          detail: `${r.amount.toFixed(6)} ${r.currency}`,
          userId: r.userId,
          adminId: null,
          createdAt: r.createdAt,
        }))
      case 'wallet':
        return (
          await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, take })
        ).map((t) => ({
          id: `wallet:${t.id}`,
          type: 'wallet' as const,
          title: `${t.type} ${t.status}`,
          detail: `${t.amount.toFixed(6)} ${t.currency}`,
          userId: t.userId ?? null,
          adminId: null,
          createdAt: t.createdAt,
        }))
    }
  }

  private mapUsage(
    rows: Array<{
      id: string
      userId: string
      model: string
      provider: string
      totalTokens: number
      requestId: string | null
      createdAt: Date
    }>,
    type: 'error' | 'request'
  ): RawLog[] {
    return rows.map((u) => ({
      id: `${type}:${u.id}`,
      type,
      title: `${u.model} · ${u.provider}`,
      detail: `${u.totalTokens} tokens${u.requestId ? ` · ${u.requestId}` : ''}`,
      userId: u.userId,
      adminId: null,
      createdAt: u.createdAt,
    }))
  }

  private paginate(rows: RawLog[], limit: number): LogsPage {
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items[items.length - 1]
    return {
      items: items.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        detail: r.detail,
        user_id: r.userId,
        admin_id: r.adminId,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null,
      has_more: hasMore,
    }
  }

  private encodeCursor(date: Date, id: string): string {
    return Buffer.from(`${date.toISOString()}:${id}`, 'utf8').toString('base64url')
  }

  private cursorDate(cursor: string | null | undefined): Date | null {
    if (!cursor) return null
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8')
      const date = new Date(raw.split(':')[0])
      return Number.isNaN(date.getTime()) ? null : date
    } catch {
      return null
    }
  }

  private isLogType(value: string): value is LogType {
    return value === 'error' || value === 'request' || value === 'admin_action' || value === 'refund' || value === 'wallet'
  }
}
