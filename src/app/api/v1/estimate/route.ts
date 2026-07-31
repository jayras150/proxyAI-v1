// ProxyAI — POST /api/v1/estimate
// Billing Milestone 8 — REST API Layer
// Read-only pre-flight: how much would this request cost, and may it
// proceed? Maps to EstimateService — never debits anything.

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { estimateSchema } from '@/lib/ai-validation'
import { generateRequestId } from '@/lib/request-id'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const requestId = generateRequestId()
  const endpoint = 'POST /api/v1/estimate'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiEstimate,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const body = await request.json().catch(() => null)
    const parsed = estimateSchema.safeParse(body)
    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
      )
      return jsonError('VALIDATION_ERROR', 'Invalid request body.', {
        status: 400,
        details,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const { modelService, estimateService, estimateUsage } = getApiServices()
    const resolved = await modelService.resolve(parsed.data.model)

    // Token estimate comes from the provider (provider-owned heuristic);
    // the estimate itself is pure EstimateService — no pricing here.
    const estimatedUsage = estimateUsage({
      model: parsed.data.model,
      messages: parsed.data.messages,
      maxTokens: parsed.data.max_tokens,
    })

    const estimate = await estimateService.estimate({
      userId: identity.userId,
      modelId: resolved.aiModel.id,
      usage: estimatedUsage,
    })

    logApiRequest({
      endpoint,
      requestId,
      correlationId,
      userId: identity.userId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        model: parsed.data.model,
        pricing_version_id: estimate.pricingVersionId,
        estimated_cost: estimate.estimatedCost.toString(),
        estimated_balance: estimate.estimatedBalance.toString(),
        currency: estimate.estimatedCost.currency,
        can_proceed: estimate.canProceed,
        reason: estimate.reason,
      },
      { requestId, headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error, requestId)
    logApiRequest({
      endpoint,
      requestId,
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
