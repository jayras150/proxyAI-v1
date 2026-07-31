// ProxyAI — POST /api/auth/logout-all
// Revokes ALL sessions for the authenticated user. Rate-limited (300/min).

import { NextRequest } from 'next/server'
import { logoutAllSessions } from '@/server/auth/logout'
import { verifyAccessToken } from '@/lib/jwt'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { getAccessToken, clearAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function POST(request: NextRequest) {
  // Rate limit: authenticated endpoint, 300 req/min.
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const accessToken = getAccessToken(request)
    if (!accessToken) {
      return jsonError('UNAUTHORIZED', 'Missing or invalid authorization header.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const payload = verifyAccessToken(accessToken)

    await logoutAllSessions(payload.sub)

    const response = jsonSuccess(
      { message: 'All sessions revoked.' },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )

    clearAuthCookies(response)

    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', { status: 401 })
    }

    console.error('Logout-all error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
