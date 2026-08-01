// ProxyAI — Prisma TransactionRepository
// Milestone 2 — Repository implementation (Transaction)

import { prisma } from '@/lib/prisma'
import type { Prisma, Transaction, TransactionType, TransactionStatus } from '@prisma/client'
import type {
  TransactionRepository,
  TransactionCreateInput,
  TransactionCursor,
  TransactionPage,
} from './transaction.repository'

export class PrismaTransactionRepository implements TransactionRepository {
  async create(
    input: TransactionCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Transaction> {
    const client = tx ?? prisma
    return client.transaction.create({ data: input })
  }

  async findByReference(reference: string) {
    return prisma.transaction.findUnique({ where: { reference } })
  }

  async findByWalletIdPaginated(
    walletId: string,
    cursor: TransactionCursor | null,
    limit: number,
    filters?: {
      type?: TransactionType
      status?: TransactionStatus
      dateFrom?: Date
      dateTo?: Date
      search?: string
    }
  ): Promise<TransactionPage> {
    const where: Prisma.TransactionWhereInput = { walletId }

    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ]
    }

    if (filters?.type) {
      where.type = filters.type
    }
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        ;(where.createdAt as Prisma.DateTimeFilter).gte = filters.dateFrom
      }
      if (filters.dateTo) {
        ;(where.createdAt as Prisma.DateTimeFilter).lte = filters.dateTo
      }
    }
    if (filters?.search) {
      where.description = { contains: filters.search, mode: 'insensitive' }
    }

    const items = await prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })

    const hasMore = items.length > limit
    const pageItems = hasMore ? items.slice(0, limit) : items
    const last = pageItems[pageItems.length - 1]

    return {
      items: pageItems,
      nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
      hasMore,
    }
  }
}
