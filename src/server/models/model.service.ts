// ProxyAI — ModelService (registry resolution)
// Billing Milestone 8 — REST API Layer
//
// API-layer plumbing only: resolves a provider model name to the billing
// identifiers the gateway needs (AiModel id + active PricingVersion id).
// No pricing math, no provider calls, no business rules.

import type { AiModel, PricingVersion } from '@prisma/client'
import type { ModelRepository } from './model.repository'
import type { PricingRepository } from '@/server/pricing/pricing.repository'

export class ModelError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ModelError'
  }
}

export const ModelErrorCode = {
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_DISABLED: 'MODEL_DISABLED',
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
} as const

export interface ResolvedModel {
  aiModel: AiModel
  pricingVersion: PricingVersion
}

export class ModelService {
  constructor(
    private readonly modelRepository: ModelRepository,
    private readonly pricingRepository: PricingRepository
  ) {}

  /** Resolve a provider model name to { AiModel, active PricingVersion }. */
  async resolve(model: string, at: Date = new Date()): Promise<ResolvedModel> {
    const aiModel = await this.modelRepository.findByModelId(model)
    if (!aiModel) {
      throw new ModelError(ModelErrorCode.MODEL_NOT_FOUND, `Unknown model: ${model}`)
    }
    if (!aiModel.enabled) {
      throw new ModelError(ModelErrorCode.MODEL_DISABLED, `Model is disabled: ${model}`)
    }

    const pricingVersion = await this.pricingRepository.findActiveByModelId(aiModel.id, at)
    if (!pricingVersion) {
      throw new ModelError(
        ModelErrorCode.PRICING_NOT_FOUND,
        `No active pricing for model: ${model}`
      )
    }

    return { aiModel, pricingVersion }
  }

  /** List enabled models (GET /v1/models). */
  async list(): Promise<AiModel[]> {
    return this.modelRepository.listEnabled()
  }
}
