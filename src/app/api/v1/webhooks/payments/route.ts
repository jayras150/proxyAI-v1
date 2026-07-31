// ProxyAI — POST /api/v1/webhooks/payments
// Blueprint Reference: Design Review Wallet §12 — Webhook Replay Protection
// Authentication: provider signature (HMAC), NOT user JWT.

import { NextRequest } from 'next/server'
import { getApiServices } from '@/server/composition'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { env } from '@/config/env'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const rate = await enforceRateLimit(request, RATE_LIMITS.webhookPayments)
  if (rate.limited) return rate.response

  try {
    const rawBody = await request.text()
    // Signature header name is provider-configurable (env), not hardcoded.
    const signature = request.headers.get(env.webhookSignatureHeader) ?? ''

    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    const { webhookService } = getApiServices()
    const result = await webhookService.handlePaymentWebhook(rawBody, signature, headers)

    logApiRequest({
      endpoint: 'POST /api/v1/webhooks/payments',
      correlationId,
      walletId: result.topupId,
      topupId: result.topupId,
      transactionId: result.transactionId,
      provider: 'mock',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    // Always ack — provider stops retrying; duplicate handling is internal.
    return jsonSuccess({ outcome: result.outcome })
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: 'POST /api/v1/webhooks/payments',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
