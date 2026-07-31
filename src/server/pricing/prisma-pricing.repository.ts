// ProxyAI — Prisma PricingRepository
// Billing Milestone 5 — Charge Service support
// Implements the PricingRepository interface (interface: src/server/pricing/pricing.repository.ts).

import { prisma } from '@/lib/prisma'
import type { PricingVersion } from '@prisma/client'
import type {
  PricingRepository,
  PricingVersionCreateInput,
} from './pricing.repository'

export class PrismaPricingRepository implements PricingRepository {
  async findActiveByModelId(modelId: string, at: Date): Promise<PricingVersion | null> {
    return prisma.pricingVersion.findFirst({
      where: {
        modelId,
        status: 'ACTIVE',
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { version: 'desc' },
    })
  }

  async findById(id: string): Promise<PricingVersion | null> {
    return prisma.pricingVersion.findUnique({ where: { id } })
  }

  async findByModelId(modelId: string): Promise<PricingVersion[]> {
    return prisma.pricingVersion.findMany({
      where: { modelId },
      orderBy: { version: 'desc' },
    })
  }

  async create(input: PricingVersionCreateInput): Promise<PricingVersion> {
    return prisma.pricingVersion.create({
      data: {
        modelId: input.modelId,
        version: input.version,
        inputPrice: input.inputPrice,
        outputPrice: input.outputPrice,
        markupPercent: input.markupPercent,
        serviceFee: input.serviceFee,
        currency: input.currency,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      },
    })
  }

  async archive(id: string, effectiveTo: Date): Promise<PricingVersion> {
    return prisma.pricingVersion.update({
      where: { id },
      data: { status: 'ARCHIVED', effectiveTo },
    })
  }
}
