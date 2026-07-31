// ProxyAI — Prisma TransactionRepository
// Milestone 2 — Repository implementation (Transaction)

import { prisma } from '@/lib/prisma'
import type { Prisma, Transaction } from '@prisma/client'
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
    limit: number
  ): Promise<TransactionPage> {
    // Fetch limit + 1 to detect whether another page exists.
    const items = await prisma.transaction.findMany({
      where: {
        walletId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
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
