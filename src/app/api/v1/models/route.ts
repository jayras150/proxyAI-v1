// ProxyAI — GET /api/v1/models
// Billing Milestone 8 — REST API Layer
// Milestone 4: enriched with capabilities, pricing, default model.
// Lists enabled models from the registry with pricing details.

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'


export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/models'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const { modelService, pricingRepository } = getApiServices()
    const models = await modelService.list()

    // Fetch active pricing for all models (best-effort; tolerates missing pricing)
    const now = new Date()
    const pricingEntries = await Promise.all(
      models.map(async (model) => {
        try {
          return await pricingRepository.findActiveByModelId(model.id, now)
        } catch {
          return null
        }
      })
    )

    logApiRequest({
      endpoint,
      correlationId,
      userId: identity.userId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        object: 'list',
        data: models.map((model, index) => {
          const pricing = pricingEntries[index]
          const capabilities = model.capabilities as Record<string, unknown> | null
          return {
            id: model.modelId,
            object: 'model',
            created: Math.floor(model.createdAt.getTime() / 1000),
            owned_by: model.provider,
            display_name: model.displayName,
            context_window: model.contextWindow,
            enabled: model.enabled,
            capabilities: {
              streaming: capabilities?.streaming ?? true,
              reasoning: capabilities?.reasoning ?? false,
              vision: capabilities?.vision ?? false,
              json_mode: capabilities?.json_mode ?? true,
              ...(capabilities ?? {}),
            },
            provider: model.provider,
            default_model: null,
            pricing: pricing
              ? {
                  input_price: pricing.inputPrice.toFixed(6),
                  output_price: pricing.outputPrice.toFixed(6),
                  markup_percent: pricing.markupPercent.toFixed(2),
                  service_fee: pricing.serviceFee.toFixed(6),
                  currency: pricing.currency,
                }
              : null,
            status: model.enabled ? 'active' : 'disabled',
          }
        }),
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint,
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
