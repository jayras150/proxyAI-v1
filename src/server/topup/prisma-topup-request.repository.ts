// ProxyAI — Prisma TopupRequestRepository
// Milestone 3 — Repository implementation (TopupRequest)

import { prisma } from '@/lib/prisma'
import type { Prisma, TopupStatus } from '@prisma/client'
import type {
  TopupRequestRepository,
  TopupRequestCreateInput,
  TopupPageCursor,
} from './topup-request.repository'

export class PrismaTopupRequestRepository implements TopupRequestRepository {
  async create(input: TopupRequestCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.topupRequest.create({ data: input })
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.topupRequest.findFirst({ where: { id, userId } })
  }

  async findById(id: string) {
    return prisma.topupRequest.findUnique({ where: { id } })
  }

  async findByProviderReference(providerReference: string) {
    return prisma.topupRequest.findUnique({ where: { providerReference } })
  }

  async updateProviderReference(id: string, providerReference: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.topupRequest.update({
      where: { id },
      data: { providerReference },
    })
  }

  async findByUserIdPaginated(
    userId: string,
    cursor: TopupPageCursor | null,
    limit: number
  ) {
    const take = Math.min(Math.max(limit, 1), 100)
    const items = await prisma.topupRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    })
    const hasMore = items.length > take
    const sliced = hasMore ? items.slice(0, take) : items
    return {
      items: sliced,
      nextCursor: hasMore ? { createdAt: sliced[sliced.length - 1].createdAt, id: sliced[sliced.length - 1].id } : null,
      hasMore,
    }
  }

  async updateStatus(id: string, status: TopupStatus, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.topupRequest.update({
      where: { id },
      data: { status },
    })
  }

  async markPaid(id: string, transactionId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    // Conditional update: only PENDING requests can be marked PAID.
    const result = await client.topupRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PAID', transactionId },
    })
    if (result.count === 0) return null
    return client.topupRequest.findUnique({ where: { id } })
  }

  async markExpired(id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    // Conditional update: only PENDING requests can be marked EXPIRED.
    const result = await client.topupRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    })
    if (result.count === 0) return null
    return client.topupRequest.findUnique({ where: { id } })
  }
}
