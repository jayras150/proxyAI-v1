// ProxyAI — Admin Models Service (Milestone 3)
// CRUD for AI models. Additive; never changes user-facing model resolution.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AdminError } from '@/lib/errors'

export interface CreateModelInput {
  displayName: string
  provider: string
  modelId: string
  contextWindow: number
  maxOutputTokens?: number
  enabled?: boolean
  capabilities?: {
    streaming?: boolean
    reasoning?: boolean
    vision?: boolean
    jsonMode?: boolean
    toolCalling?: boolean
    embeddings?: boolean
    imageGeneration?: boolean
  }
}

export interface UpdateModelInput {
  displayName?: string
  provider?: string
  modelId?: string
  contextWindow?: number
  maxOutputTokens?: number
  enabled?: boolean
  capabilities?: {
    streaming?: boolean
    reasoning?: boolean
    vision?: boolean
    jsonMode?: boolean
    toolCalling?: boolean
    embeddings?: boolean
    imageGeneration?: boolean
  }
}

export interface ModelListItem {
  id: string
  display_name: string
  provider: string
  model_id: string
  context_window: number
  max_output_tokens: number | null
  enabled: boolean
  capabilities: Record<string, unknown> | null
  default_model: boolean
  pricing_version: {
    id: string
    version: number
    status: string
    input_price: string
    output_price: string
    currency: string
  } | null
  created_at: string
  updated_at: string
}

export interface ModelListResponse {
  items: ModelListItem[]
  next_cursor: string | null
  has_more: boolean
}

export class AdminModelsService {
  /**
   * List models with search, filter, and cursor pagination.
   */
  async list(params: {
    cursor?: string
    limit?: number
    search?: string
    provider?: string
    enabled?: boolean
  }): Promise<ModelListResponse> {
    const limit = params.limit ?? 20

    const where: Prisma.AiModelWhereInput = {}
    if (params.search) {
      where.OR = [
        { displayName: { contains: params.search, mode: 'insensitive' } },
        { modelId: { contains: params.search, mode: 'insensitive' } },
        { provider: { contains: params.search, mode: 'insensitive' } },
      ]
    }
    if (params.provider) {
      where.provider = { contains: params.provider, mode: 'insensitive' }
    }
    if (params.enabled !== undefined) {
      where.enabled = params.enabled
    }

    const models = await prisma.aiModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        pricingVersions: {
          where: { status: 'ACTIVE' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    })

    const hasMore = models.length > limit
    const items = hasMore ? models.slice(0, limit) : models
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return {
      items: items.map((m) => ({
        id: m.id,
        display_name: m.displayName,
        provider: m.provider,
        model_id: m.modelId,
        context_window: m.contextWindow,
        max_output_tokens: (m.capabilities as Record<string, unknown> | null)?.maxOutputTokens as number | null ?? null,
        enabled: m.enabled,
        capabilities: m.capabilities as Record<string, unknown> | null,
        default_model: false, // computed — will be from AiConfiguration
        pricing_version: m.pricingVersions[0]
          ? {
              id: m.pricingVersions[0].id,
              version: m.pricingVersions[0].version,
              status: m.pricingVersions[0].status,
              input_price: m.pricingVersions[0].inputPrice.toFixed(6),
              output_price: m.pricingVersions[0].outputPrice.toFixed(6),
              currency: m.pricingVersions[0].currency,
            }
          : null,
        created_at: m.createdAt.toISOString(),
        updated_at: m.updatedAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    }
  }

  /**
   * Get a single model by ID.
   */
  async getById(id: string): Promise<ModelListItem | null> {
    const model = await prisma.aiModel.findUnique({
      where: { id },
      include: {
        pricingVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          where: { status: 'ACTIVE' },
        },
      },
    })

    if (!model) return null

    return {
      id: model.id,
      display_name: model.displayName,
      provider: model.provider,
      model_id: model.modelId,
      context_window: model.contextWindow,
      max_output_tokens: (model.capabilities as Record<string, unknown> | null)?.maxOutputTokens as number | null ?? null,
      enabled: model.enabled,
      capabilities: model.capabilities as Record<string, unknown> | null,
      default_model: false,
      pricing_version: model.pricingVersions[0]
        ? {
            id: model.pricingVersions[0].id,
            version: model.pricingVersions[0].version,
            status: model.pricingVersions[0].status,
            input_price: model.pricingVersions[0].inputPrice.toFixed(6),
            output_price: model.pricingVersions[0].outputPrice.toFixed(6),
            currency: model.pricingVersions[0].currency,
          }
        : null,
      created_at: model.createdAt.toISOString(),
      updated_at: model.updatedAt.toISOString(),
    }
  }

  /**
   * Create a new AI model.
   */
  async create(input: CreateModelInput, adminId: string) {
    const model = await prisma.aiModel.create({
      data: {
        displayName: input.displayName,
        provider: input.provider,
        modelId: input.modelId,
        contextWindow: input.contextWindow,
        enabled: input.enabled ?? true,
        capabilities: {
          streaming: input.capabilities?.streaming ?? false,
          reasoning: input.capabilities?.reasoning ?? false,
          vision: input.capabilities?.vision ?? false,
          jsonMode: input.capabilities?.jsonMode ?? false,
          toolCalling: input.capabilities?.toolCalling ?? false,
          embeddings: input.capabilities?.embeddings ?? false,
          imageGeneration: input.capabilities?.imageGeneration ?? false,
          maxOutputTokens: input.maxOutputTokens ?? null,
        },
      },
    })

    return model
  }

  /**
   * Update an existing AI model.
   */
  async update(id: string, input: UpdateModelInput, adminId: string): Promise<{ id: string }> {
    const existing = await prisma.aiModel.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError('NOT_FOUND', 'Model not found.')
    }

    const updateData: Prisma.AiModelUpdateInput = {}
    if (input.displayName !== undefined) updateData.displayName = input.displayName
    if (input.provider !== undefined) updateData.provider = input.provider
    if (input.modelId !== undefined) updateData.modelId = input.modelId
    if (input.contextWindow !== undefined) updateData.contextWindow = input.contextWindow
    if (input.enabled !== undefined) updateData.enabled = input.enabled

    if (input.capabilities !== undefined || input.maxOutputTokens !== undefined) {
      const currentCaps = (existing.capabilities as Record<string, unknown> | null) ?? {}
      updateData.capabilities = {
        ...currentCaps,
        ...(input.capabilities ?? {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
      }
    }

    await prisma.aiModel.update({
      where: { id },
      data: updateData,
    })

    return { id }
  }

  /**
   * Toggle model enabled/disabled.
   */
  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    const model = await prisma.aiModel.findUnique({ where: { id } })
    if (!model) {
      throw new AdminError('NOT_FOUND', 'Model not found.')
    }
    await prisma.aiModel.update({
      where: { id },
      data: { enabled },
    })
  }

  /**
   * Archive a model (disable soft-delete).
   */
  async archive(id: string): Promise<void> {
    const model = await prisma.aiModel.findUnique({ where: { id } })
    if (!model) {
      throw new AdminError('NOT_FOUND', 'Model not found.')
    }
    await prisma.aiModel.update({
      where: { id },
      data: { enabled: false },
    })
  }
}
