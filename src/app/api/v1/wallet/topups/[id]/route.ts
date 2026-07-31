// ProxyAI — GET /api/v1/wallet/topups/:id
// Poll top-up status. Owner-scoped.

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { topupQuerySchema } from '@/lib/wallet-validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)

  try {
    const payload = getAuthenticatedUser(request)

    // Rate limit keyed by userId (JWT subject), fallback IP.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.walletRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const { id } = await params

    const parsed = topupQuerySchema.safeParse({ id })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid top-up id.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const { topupService } = getApiServices()
    const topup = await topupService.getTopup(parsed.data.id, payload.sub)

    logApiRequest({
      endpoint: 'GET /api/v1/wallet/topups/:id',
      correlationId,
      userId: payload.sub,
      walletId: topup.walletId,
      topupId: topup.id,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        id: topup.id,
        status: topup.status,
        amount: topup.amount.toFixed(6),
        currency: topup.currency,
        provider: topup.provider,
        provider_reference: topup.providerReference,
        transaction_id: topup.transactionId,
        expires_at: topup.expiresAt.toISOString(),
        created_at: topup.createdAt.toISOString(),
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: 'GET /api/v1/wallet/topups/:id',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
