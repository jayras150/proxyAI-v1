// ProxyAI — POST /api/v1/chat/completions
// Billing Milestone 8 — REST API Layer
// Thin HTTP adapter: validate → authenticate → resolve model → AIGateway →
// map response/error. No business logic in this file.

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { chatCompletionSchema } from '@/lib/ai-validation'
import { generateRequestId } from '@/lib/request-id'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const requestId = generateRequestId()
  const endpoint = 'POST /api/v1/chat/completions'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiChat,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const body = await request.json().catch(() => null)
    const parsed = chatCompletionSchema.safeParse(body)
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

    const { aiGateway, modelService } = getApiServices()

    // API-layer plumbing: model name → billing identifiers (no business rules).
    const resolved = await modelService.resolve(parsed.data.model)

    const response = await aiGateway.process({
      requestId,
      correlationId,
      userId: identity.userId,
      model: parsed.data.model,
      modelId: resolved.aiModel.id,
      pricingVersionId: resolved.pricingVersion.id,
      messages: parsed.data.messages,
      temperature: parsed.data.temperature,
      topP: parsed.data.top_p,
      maxTokens: parsed.data.max_tokens,
      stream: parsed.data.stream,
      idempotencyKey: parsed.data.idempotency_key,
      clientIp: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    logApiRequest({
      endpoint,
      requestId,
      correlationId,
      userId: identity.userId,
      transactionId: response.billing.transactionId,
      provider: response.provider,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        id: `chatcmpl_${requestId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: response.response.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: response.response.content },
            finish_reason: response.response.finishReason,
          },
        ],
        usage: {
          prompt_tokens: response.usage.promptTokens,
          completion_tokens: response.usage.completionTokens,
          total_tokens: response.usage.totalTokens,
          prompt_tokens_details: { cached_tokens: response.usage.cachedTokens },
        },
        provider: response.provider,
        provider_request_id: response.response.providerRequestId,
        billing: {
          transaction_id: response.billing.transactionId,
          usage_log_id: response.billing.usageLogId,
          pricing_version_id: response.billing.pricingVersionId,
          total_cost: response.billing.totalCost.toString(),
          currency: response.billing.currency,
          wallet_balance_before: response.billing.walletBalanceBefore.toString(),
          wallet_balance_after: response.billing.walletBalanceAfter.toString(),
          wallet_status_after: response.billing.walletStatusAfter,
        },
        latency: {
          total_ms: response.latency.totalMs,
          provider_ms: response.latency.providerMs,
          billing_ms: response.latency.billingMs,
        },
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
