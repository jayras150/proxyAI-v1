// ProxyAI — GET /api/v1/dashboard/summary
// User Dashboard Milestone 2 — Home
//
// Single-round-trip summary for the Dashboard Home page (design doc §6.1 #1).
// One request returns balance, wallet status, today/month usage, recent
// transactions (5), recent usage (5), active key count, model registry
// summary and provider status — the client makes exactly ONE call.

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { getApiServices } from '@/server/composition'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/dashboard/summary'

  try {
    // Dashboard is browser-only → JWT (HttpOnly cookie) auth, like /v1/wallet.
    const payload = getAuthenticatedUser(request)

    // Keyed by userId — never shared across users behind the same NAT.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const { dashboardService } = getApiServices()
    const summary = await dashboardService.getSummary(payload.sub)

    logApiRequest({
      endpoint,
      correlationId,
      userId: payload.sub,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        balance: summary.balance,
        currency: summary.currency,
        wallet_status: summary.wallet_status,
        requests_today: summary.requests_today,
        tokens_today: summary.tokens_today,
        spend_today: summary.spend_today,
        spend_month: summary.spend_month,
        spend_previous_month: summary.spend_previous_month,
        active_keys: summary.active_keys,
        available_models: summary.available_models,
        default_model: summary.default_model,
        latest_transactions: summary.latest_transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount.toFixed(6),
          balance_after: tx.balanceAfter.toFixed(6),
          currency: tx.currency,
          status: tx.status,
          description: tx.description,
          created_at: tx.createdAt.toISOString(),
        })),
        latest_usage: summary.latest_usage.map((log) => ({
          id: log.id,
          model: log.model,
          provider: log.provider,
          status: log.status,
          total_tokens: log.totalTokens,
          user_cost: log.userCost.toFixed(6),
          currency: log.currency,
          created_at: log.createdAt.toISOString(),
        })),
        provider: summary.provider,
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
