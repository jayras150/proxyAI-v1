// ProxyAI — Prisma ModelRepository
// Billing Milestone 8 — REST API Layer (model registry resolution)

import { prisma } from '@/lib/prisma'
import type { AiModel } from '@prisma/client'
import type { ModelRepository } from './model.repository'

export class PrismaModelRepository implements ModelRepository {
  async findByModelId(modelId: string): Promise<AiModel | null> {
    return prisma.aiModel.findUnique({ where: { modelId } })
  }

  async listEnabled(): Promise<AiModel[]> {
    return prisma.aiModel.findMany({
      where: { enabled: true },
      orderBy: { modelId: 'asc' },
    })
  }
}
