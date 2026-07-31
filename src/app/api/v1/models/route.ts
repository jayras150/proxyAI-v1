// ProxyAI — GET /api/v1/models
// Billing Milestone 8 — REST API Layer
// Lists enabled models from the registry (OpenAI-compatible shape).

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

    const { modelService } = getApiServices()
    const models = await modelService.list()

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
        data: models.map((model) => ({
          id: model.modelId,
          object: 'model',
          created: Math.floor(model.createdAt.getTime() / 1000),
          owned_by: model.provider,
          display_name: model.displayName,
          context_window: model.contextWindow,
        })),
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
