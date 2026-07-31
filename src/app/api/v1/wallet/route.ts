// ProxyAI — GET /api/v1/wallet
// Blueprint Reference: Sprint 9 §64 — Wallet APIs

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { getApiServices } from '@/server/composition'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)

  try {
    const payload = getAuthenticatedUser(request)

    // Rate limit keyed by userId (JWT subject), fallback IP — never shared
    // across users behind the same NAT.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.walletRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const { walletService } = getApiServices()
    const wallet = await walletService.getWallet(payload.sub)

    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }

    logApiRequest({
      endpoint: 'GET /api/v1/wallet',
      correlationId,
      userId: payload.sub,
      walletId: wallet.id,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        id: wallet.id,
        balance: wallet.balance.toFixed(6),
        currency: wallet.currency,
        status: wallet.status,
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: 'GET /api/v1/wallet',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
