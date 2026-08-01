// ProxyAI — Prisma UsageRepository
// Billing Milestone 5 — Charge Service support
// Milestone 4: filter support for findByUserIdPaginated.
// Implements the UsageRepository interface (interface: src/server/usage/usage.repository.ts).

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { UsageLog, UsageStatus } from '@prisma/client'
import type { Cursor } from '@/server/db/pagination'
import type {
  UsageLogCreateInput,
  UsageLogPage,
  UsageFilters,
  UsagePeriodSummary,
  UsageRepository,
} from './usage.repository'

export class PrismaUsageRepository implements UsageRepository {
  /** Create an immutable usage log. No update/delete paths exist (except status). */
  async create(input: UsageLogCreateInput, tx?: Prisma.TransactionClient): Promise<UsageLog> {
    const client = tx ?? prisma
    return client.usageLog.create({
      data: {
        userId: input.userId,
        apiKeyId: input.apiKeyId ?? null,
        provider: input.provider,
        model: input.model,
        modelId: input.modelId ?? null,
        pricingVersionId: input.pricingVersionId ?? null,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        cachedTokens: input.cachedTokens ?? 0,
        totalTokens: input.totalTokens,
        providerCost: input.providerCost,
        userCost: input.userCost,
        currency: input.currency,
        latencyMs: input.latencyMs ?? null,
        status: input.status ?? 'PENDING',
        requestId: input.requestId ?? null,
        inputPrice: input.inputPrice ?? null,
        outputPrice: input.outputPrice ?? null,
        markupPercent: input.markupPercent ?? null,
        serviceFee: input.serviceFee ?? null,
      },
    })
  }

  async findById(id: string): Promise<UsageLog | null> {
    return prisma.usageLog.findUnique({ where: { id } })
  }

  async findByRequestId(requestId: string): Promise<UsageLog | null> {
    return prisma.usageLog.findFirst({ where: { requestId } })
  }

  async findByUserIdPaginated(
    userId: string,
    cursor: Cursor | null,
    limit: number,
    filters?: UsageFilters
  ): Promise<UsageLogPage> {
    const where: Prisma.UsageLogWhereInput = { userId }

    if (filters) {
      if (filters.search) {
        where.OR = [
          { model: { contains: filters.search, mode: 'insensitive' } },
          { provider: { contains: filters.search, mode: 'insensitive' } },
          { requestId: { contains: filters.search, mode: 'insensitive' } },
        ]
      }
      if (filters.model) {
        where.model = { contains: filters.model, mode: 'insensitive' }
      }
      if (filters.status) {
        where.status = filters.status as UsageStatus
      }
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo
        }
      }
    }

    const items = await prisma.usageLog.findMany({
      where,
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

  /**
   * Aggregate charged usage in [from, to). Only COMPLETED logs count
   * (PENDING is in-flight, FAILED never charged, REFUNDED was reversed) —
   * this keeps dashboard spend consistent with settled wallet debits.
   */
  async aggregatePeriod(
    userId: string,
    from: Date,
    to: Date
  ): Promise<UsagePeriodSummary> {
    const result = await prisma.usageLog.aggregate({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
      _sum: { totalTokens: true, userCost: true },
    })

    return {
      requests: result._count._all,
      tokens: result._sum.totalTokens ?? 0,
      cost: result._sum.userCost ?? new Prisma.Decimal(0),
    }
  }

  async updateStatus(
    id: string,
    status: UsageStatus,
    tx?: Prisma.TransactionClient
  ): Promise<UsageLog> {
    const client = tx ?? prisma
    return client.usageLog.update({ where: { id }, data: { status } })
  }

  async markRefunded(id: string, tx?: Prisma.TransactionClient): Promise<UsageLog | null> {
    const client = tx ?? prisma
    return client.usageLog.update({
      where: { id, status: 'COMPLETED' },
      data: { status: 'REFUNDED' },
    })
  }
}
