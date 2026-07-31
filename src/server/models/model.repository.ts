// ProxyAI — ModelRepository Interface
// Billing Milestone 8 — REST API Layer (model registry resolution)

import type { AiModel } from '@prisma/client'

export interface ModelRepository {
  /** Find a model by its provider model id (e.g. 'deepseek-chat'). */
  findByModelId(modelId: string): Promise<AiModel | null>

  /** List enabled models (GET /v1/models). */
  listEnabled(): Promise<AiModel[]>
}
