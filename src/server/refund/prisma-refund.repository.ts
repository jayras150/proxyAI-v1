// ProxyAI — Prisma RefundRepository
// Billing Milestone 6 — Refund Service support
// Implements the RefundRepository interface (interface: src/server/refund/refund.repository.ts).
// Optimistic locking: every status transition is guarded by an expected
// version; a stale write returns null and the caller's transaction rolls back.

import { prisma } from '@/lib/prisma'
import type { Prisma, RefundRequest, RefundStatus } from '@prisma/client'
import type { Cursor } from '@/server/db/pagination'
import type {
  RefundRepository,
  RefundRequestCreateInput,
  RefundRequestPage,
} from './refund.repository'

export class PrismaRefundRepository implements RefundRepository {
  /** Create a refund request (REQUESTED, version 1). */
  async create(input: RefundRequestCreateInput, tx?: Prisma.TransactionClient): Promise<RefundRequest> {
    const client = tx ?? prisma
    return client.refundRequest.create({
      data: {
        userId: input.userId,
        usageLogId: input.usageLogId,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason ?? null,
        requestedBy: input.requestedBy,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  }

  async findById(id: string): Promise<RefundRequest | null> {
    return prisma.refundRequest.findUnique({ where: { id } })
  }

  async findByUsageLogId(usageLogId: string): Promise<RefundRequest | null> {
    return prisma.refundRequest.findUnique({ where: { usageLogId } })
  }

  async findByUserIdPaginated(
    userId: string,
    cursor: Cursor | null,
    limit: number
  ): Promise<RefundRequestPage> {
    const items = await prisma.refundRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor.id },
            skip: 1,
          }
        : {}),
    })

    const hasMore = items.length > limit
    const pageItems = hasMore ? items.slice(0, limit) : items
    const last = pageItems[pageItems.length - 1]

    return {
      items: pageItems,
      nextCursor: hasMore && last ? { id: last.id, createdAt: last.createdAt } : null,
      hasMore,
    }
  }

  /** Guarded status transition (expectedVersion). Null when the version is stale. */
  async updateStatus(
    id: string,
    status: RefundStatus,
    expectedVersion: number,
    tx?: Prisma.TransactionClient
  ): Promise<RefundRequest | null> {
    const client = tx ?? prisma
    const result = await client.refundRequest.updateMany({
      where: { id, version: expectedVersion },
      data: { status, version: { increment: 1 } },
    })
    if (result.count === 0) return null
    return client.refundRequest.findUnique({ where: { id } })
  }

  /**
   * REQUESTED/APPROVED → COMPLETED, linking the REFUND transaction.
   * Guarded by expectedVersion + status (once, only). Null when stale or
   * already completed.
   */
  async markCompleted(
    id: string,
    transactionId: string,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
    approvedBy?: string
  ): Promise<RefundRequest | null> {
    const client = tx ?? prisma
    const result = await client.refundRequest.updateMany({
      where: {
        id,
        version: expectedVersion,
        status: { in: ['REQUESTED', 'APPROVED'] },
      },
      data: {
        status: 'COMPLETED',
        transactionId,
        approvedBy: approvedBy ?? null,
        version: { increment: 1 },
      },
    })
    if (result.count === 0) return null
    return client.refundRequest.findUnique({ where: { id } })
  }
}
