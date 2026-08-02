// ProxyAI — Admin Pricing Service (Milestone 3)
// Manages PricingVersion lifecycle: create, activate, archive, compare.

import { prisma } from '@/lib/prisma'
import { AdminError } from '@/lib/errors'
import Decimal from 'decimal.js'

export interface CreatePricingInput {
  modelId: string
  inputPrice: string
  outputPrice: string
  markupPercent?: string
  serviceFee?: string
  currency?: string
  effectiveFrom: string
  effectiveTo?: string | null
}

export interface PricingListItem {
  id: string
  model_id: string
  model_name: string
  provider: string
  version: number
  input_price: string
  output_price: string
  markup_percent: string
  service_fee: string
  currency: string
  effective_from: string
  effective_to: string | null
  status: string
  created_at: string
}

export class AdminPricingService {
  /**
   * List pricing versions with filters and cursor pagination.
   */
  async list(params: {
    cursor?: string
    limit?: number
    modelId?: string
    status?: string
  }) {
    const limit = params.limit ?? 20

    const where: Record<string, unknown> = {}
    if (params.modelId) where.modelId = params.modelId
    if (params.status) where.status = params.status

    const versions = await prisma.pricingVersion.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        aiModel: { select: { displayName: true, provider: true } },
      },
    })

    const hasMore = versions.length > limit
    const items = hasMore ? versions.slice(0, limit) : versions
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return {
      items: items.map((v) => ({
        id: v.id,
        model_id: v.modelId,
        model_name: v.aiModel.displayName,
        provider: v.aiModel.provider,
        version: v.version,
        input_price: v.inputPrice.toFixed(6),
        output_price: v.outputPrice.toFixed(6),
        markup_percent: v.markupPercent.toFixed(2),
        service_fee: v.serviceFee.toFixed(6),
        currency: v.currency,
        effective_from: v.effectiveFrom.toISOString(),
        effective_to: v.effectiveTo?.toISOString() ?? null,
        status: v.status,
        created_at: v.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    }
  }

  /**
   * Get current active pricing version for a model.
   */
  async getActiveByModel(modelId: string) {
    const version = await prisma.pricingVersion.findFirst({
      where: { modelId, status: 'ACTIVE', effectiveFrom: { lte: new Date() } },
      orderBy: { version: 'desc' },
    })
    return version
  }

  /**
   * Create a new pricing version. Auto-increments version number.
   */
  async create(input: CreatePricingInput, adminId: string) {
    const model = await prisma.aiModel.findUnique({ where: { id: input.modelId } })
    if (!model) {
      throw new AdminError('NOT_FOUND', 'Model not found.')
    }

    // Determine next version number
    const lastVersion = await prisma.pricingVersion.findFirst({
      where: { modelId: input.modelId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1

    const version = await prisma.pricingVersion.create({
      data: {
        modelId: input.modelId,
        version: nextVersion,
        inputPrice: new Decimal(input.inputPrice).toFixed(6),
        outputPrice: new Decimal(input.outputPrice).toFixed(6),
        markupPercent: input.markupPercent ?? '0',
        serviceFee: input.serviceFee ?? '0',
        currency: (input.currency ?? 'USD') as never,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status: 'ACTIVE',
      },
    })

    return version
  }

  /**
   * Activate a specific pricing version (archives others for the same model).
   */
  async activate(id: string, adminId: string) {
    const version = await prisma.pricingVersion.findUnique({
      where: { id },
      include: { aiModel: true },
    })
    if (!version) {
      throw new AdminError('NOT_FOUND', 'Pricing version not found.')
    }

    // Archive all active versions for this model
    await prisma.pricingVersion.updateMany({
      where: { modelId: version.modelId, status: 'ACTIVE', id: { not: id } },
      data: { status: 'ARCHIVED' },
    })

    // Activate the target version
    await prisma.pricingVersion.update({
      where: { id },
      data: { status: 'ACTIVE' },
    })

    return { id, model_id: version.modelId, version: version.version, status: 'ACTIVE' }
  }

  /**
   * Archive a pricing version.
   */
  async archive(id: string, adminId: string) {
    const version = await prisma.pricingVersion.findUnique({ where: { id } })
    if (!version) {
      throw new AdminError('NOT_FOUND', 'Pricing version not found.')
    }
    if (version.status === 'ARCHIVED') {
      throw new AdminError('CONFLICT', 'Pricing version is already archived.')
    }

    await prisma.pricingVersion.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    })

    return { id, status: 'ARCHIVED' }
  }

  /**
   * Get pricing version history for a model.
   */
  async getHistory(modelId: string) {
    const versions = await prisma.pricingVersion.findMany({
      where: { modelId },
      orderBy: { version: 'desc' },
      include: {
        aiModel: { select: { displayName: true, provider: true } },
      },
    })

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      input_price: v.inputPrice.toFixed(6),
      output_price: v.outputPrice.toFixed(6),
      markup_percent: v.markupPercent.toFixed(2),
      service_fee: v.serviceFee.toFixed(6),
      currency: v.currency,
      effective_from: v.effectiveFrom.toISOString(),
      effective_to: v.effectiveTo?.toISOString() ?? null,
      status: v.status,
      created_at: v.createdAt.toISOString(),
      model_name: v.aiModel.displayName,
      provider: v.aiModel.provider,
    }))
  }

  /**
   * Compare two pricing versions.
   */
  async compare(versionIdA: string, versionIdB: string) {
    const [a, b] = await Promise.all([
      prisma.pricingVersion.findUnique({ where: { id: versionIdA }, include: { aiModel: true } }),
      prisma.pricingVersion.findUnique({ where: { id: versionIdB }, include: { aiModel: true } }),
    ])

    if (!a || !b) {
      throw new AdminError('NOT_FOUND', 'One or both pricing versions not found.')
    }

    return {
      model_name: a.aiModel.displayName,
      provider: a.aiModel.provider,
      version_a: {
        id: a.id,
        version: a.version,
        input_price: a.inputPrice.toFixed(6),
        output_price: a.outputPrice.toFixed(6),
        markup_percent: a.markupPercent.toFixed(2),
        service_fee: a.serviceFee.toFixed(6),
        currency: a.currency,
        effective_from: a.effectiveFrom.toISOString(),
        effective_to: a.effectiveTo?.toISOString() ?? null,
        status: a.status,
        created_at: a.createdAt.toISOString(),
      },
      version_b: {
        id: b.id,
        version: b.version,
        input_price: b.inputPrice.toFixed(6),
        output_price: b.outputPrice.toFixed(6),
        markup_percent: b.markupPercent.toFixed(2),
        service_fee: b.serviceFee.toFixed(6),
        currency: b.currency,
        effective_from: b.effectiveFrom.toISOString(),
        effective_to: b.effectiveTo?.toISOString() ?? null,
        status: b.status,
        created_at: b.createdAt.toISOString(),
      },
    }
  }
}
