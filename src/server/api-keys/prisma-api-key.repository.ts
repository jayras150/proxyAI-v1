// ProxyAI — Prisma ApiKeyRepository
// Billing Milestone 8 — REST API Layer (API key authentication)

import { prisma } from '@/lib/prisma'
import type { ApiKey } from '@prisma/client'
import type { ApiKeyRepository } from './api-key.repository'

export class PrismaApiKeyRepository implements ApiKeyRepository {
  async findByHash(hash: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({ where: { keyHash: hash } })
  }

  async touchLastUsed(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.apiKey.count({ where: { userId, status: 'ACTIVE' } })
  }
}
