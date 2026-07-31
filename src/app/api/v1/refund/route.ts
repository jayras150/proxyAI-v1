// ProxyAI — POST /api/v1/refund
// Billing Milestone 8 — REST API Layer
// Refunds a charged usage log (user's own, or any user when ADMIN).
// Maps to RefundService — no wallet/billing logic here.

import { NextRequest } from 'next/server'
import { authenticateRequest, requireRole } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { refundSchema } from '@/lib/ai-validation'
import { generateRequestId } from '@/lib/request-id'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const requestId = generateRequestId()
  const endpoint = 'POST /api/v1/refund'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRefund,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const body = await request.json().catch(() => null)
    const parsed = refundSchema.safeParse(body)
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

    // Authorization: only admins may refund another user's usage.
    let targetUserId = identity.userId
    if (parsed.data.user_id) {
      requireRole(identity, ['ADMIN', 'SUPER_ADMIN'])
      targetUserId = parsed.data.user_id
    }

    const { refundService } = getApiServices()
    const result = await refundService.refund({
      usageLogId: parsed.data.usage_log_id,
      userId: targetUserId,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotency_key,
      requestId,
      requestedBy: `${identity.authMethod === 'jwt' ? 'user' : 'apikey'}:${identity.userId}`,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    logApiRequest({
      endpoint,
      requestId,
      correlationId,
      userId: identity.userId,
      transactionId: result.transactionId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        refund_request_id: result.refundRequestId,
        usage_log_id: result.usageLogId,
        transaction_id: result.transactionId,
        amount: result.amount,
        currency: result.currency,
        refund_status: result.refundStatus,
        usage_status: result.usageStatus,
        wallet_balance_after: result.walletBalanceAfter,
        replayed: result.replayed,
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
