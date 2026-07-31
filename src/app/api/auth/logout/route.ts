// ProxyAI — POST /api/auth/logout
// Blueprint Reference: Sprint 9 — Authentication APIs
// Revokes ONLY the current session (identified by the refresh cookie).

import { NextRequest } from 'next/server'
import { logoutSession } from '@/server/auth/logout'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { getRefreshToken, clearAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function POST(request: NextRequest) {
  // Rate limit: public endpoint, 60 req/min per IP.
  const rate = await enforceRateLimit(request, RATE_LIMITS.authPublic)
  if (rate.limited) return rate.response

  try {
    const refreshToken = getRefreshToken(request)

    if (refreshToken) {
      // Revoke only the session that owns this refresh token.
      await logoutSession(refreshToken)
    }

    const response = jsonSuccess(
      { message: 'Logged out successfully.' },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )

    clearAuthCookies(response)

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
