// ProxyAI — GET /api/v1/usage/[id]
// Milestone 4 — Usage Detail
// Returns full details for a single usage log (read-only).

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/usage/[id]'
  const { id } = await params

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const { usageRepository } = getApiServices()
    const log = await usageRepository.findById(id)

    if (!log) {
      return jsonError('NOT_FOUND', 'Usage log not found.', { status: 404 })
    }

    // Ensure the user can only view their own logs
    if (log.userId !== identity.userId) {
      return jsonError('FORBIDDEN', 'You do not have access to this usage log.', { status: 403 })
    }

    logApiRequest({
      endpoint,
      correlationId,
      userId: identity.userId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    // Compute reasoning_tokens as delta (approximation)
    const reasoningTokens = Math.max(0, log.totalTokens - log.promptTokens - log.completionTokens - log.cachedTokens)

    return jsonSuccess({
      id: log.id,
      request_id: log.requestId,
      model: log.model,
      provider: log.provider,
      status: log.status,
      pricing_version_id: log.pricingVersionId,
      prompt_tokens: log.promptTokens,
      completion_tokens: log.completionTokens,
      cached_tokens: log.cachedTokens,
      reasoning_tokens: reasoningTokens,
      total_tokens: log.totalTokens,
      user_cost: log.userCost.toFixed(6),
      currency: log.currency,
      latency_ms: log.latencyMs,
      input_price: log.inputPrice?.toFixed(6) ?? null,
      output_price: log.outputPrice?.toFixed(6) ?? null,
      markup_percent: log.markupPercent?.toFixed(2) ?? null,
      service_fee: log.serviceFee?.toFixed(6) ?? null,
      created_at: log.createdAt.toISOString(),
    })
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
