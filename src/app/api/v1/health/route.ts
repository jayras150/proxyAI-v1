// ProxyAI — GET /api/v1/health
// Billing Milestone 8 — REST API Layer
// Public liveness probe + provider health (no secrets, no business logic).

import { NextRequest } from 'next/server'
import { getApiServices } from '@/server/composition'
import { jsonSuccess } from '@/lib/api-response'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/health'

  const rate = await enforceRateLimit(request, RATE_LIMITS.aiHealth)
  if (rate.limited) return rate.response

  const { providerInfo, providerHealth } = getApiServices()

  // Provider health never fails the probe — it is reported alongside.
  const health = await providerHealth().catch(() => ({ ok: false, latencyMs: null }))

  logApiRequest({
    endpoint,
    correlationId,
    statusCode: 200,
    durationMs: Date.now() - startedAt,
  })

  return jsonSuccess(
    {
      status: 'ok',
      provider: providerInfo.id,
      provider_healthy: health.ok,
      provider_latency_ms: health.latencyMs,
      timestamp: new Date().toISOString(),
    },
    { headers: rateLimitHeaders(rate.result) }
  )
}
