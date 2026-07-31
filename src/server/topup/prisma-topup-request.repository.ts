// ProxyAI — Prisma TopupRequestRepository
// Milestone 3 — Repository implementation (TopupRequest)

import { prisma } from '@/lib/prisma'
import type { Prisma, TopupStatus } from '@prisma/client'
import type {
  TopupRequestRepository,
  TopupRequestCreateInput,
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
}
