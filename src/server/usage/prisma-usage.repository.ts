// ProxyAI — Prisma UsageRepository
// Billing Milestone 5 — Charge Service support
// Implements the UsageRepository interface (interface: src/server/usage/usage.repository.ts).

import { prisma } from '@/lib/prisma'
import type { Prisma, UsageLog, UsageStatus } from '@prisma/client'
import type { Cursor } from '@/server/db/pagination'
import type { UsageLogCreateInput, UsageLogPage, UsageRepository } from './usage.repository'

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
    limit: number
  ): Promise<UsageLogPage> {
    const items = await prisma.usageLog.findMany({
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
