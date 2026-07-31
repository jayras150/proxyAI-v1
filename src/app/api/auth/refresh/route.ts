// ProxyAI — POST /api/auth/refresh
// Blueprint Reference: Sprint 9 — Authentication APIs
// Rotates the refresh token and sets fresh HttpOnly cookies. Rate-limited (60/min/IP).

import { NextRequest } from 'next/server'
import { refreshTokens } from '@/server/auth/refresh'
import { AuthError } from '@/lib/errors'
import { refreshSchema } from '@/lib/validation'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { getRefreshToken, setAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function POST(request: NextRequest) {
  // Rate limit: public endpoint, 60 req/min per IP.
  const rate = await enforceRateLimit(request, RATE_LIMITS.authPublic)
  if (rate.limited) return rate.response

  try {
    // Prefer the HttpOnly refresh cookie; allow body fallback for API clients.
    const body = await request.json().catch(() => ({}))
    const refreshToken = getRefreshToken(request) ?? body.refreshToken

    if (!refreshToken) {
      return jsonError('VALIDATION_ERROR', 'Refresh token is required.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const parsed = refreshSchema.safeParse({ refreshToken })
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const result = await refreshTokens(parsed.data.refreshToken)

    const response = jsonSuccess({ user: result.user }, {
      status: 200,
      headers: rateLimitHeaders(rate.result),
    })

    // Fresh tokens go into HttpOnly cookies (old refresh token already rotated).
    setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      const status =
        error.code === 'REFRESH_TOKEN_EXPIRED' ? 401 :
        error.code === 'ACCOUNT_SUSPENDED' ? 403 : 401
      return jsonError(error.code, error.message, { status })
    }

    console.error('Token refresh error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
