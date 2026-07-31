// ProxyAI — Prisma IdempotencyKeyRepository
// Milestone 3 — Repository implementation (IdempotencyKey)

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { IdempotencyKeyRepository, IdempotencyKeyCreateInput } from './idempotency-key.repository'

export class PrismaIdempotencyKeyRepository implements IdempotencyKeyRepository {
  async findActive(key: string, scope: string, userId: string, now: Date, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.idempotencyKey.findFirst({
      where: {
        key,
        scope,
        userId,
        expiresAt: { gt: now },
      },
    })
  }

  async create(input: IdempotencyKeyCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.idempotencyKey.create({ data: input })
  }

  async complete(id: string, response: Prisma.InputJsonValue, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.idempotencyKey.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        response,
      },
    })
  }

  async deleteExpired(now: Date) {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: now } },
    })
    return result.count
  }
}
