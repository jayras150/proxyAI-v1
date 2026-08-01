// ProxyAI — POST /api/admin/auth/logout
// Admin logout — revokes current session.

import { NextRequest } from 'next/server'
import { logoutSession } from '@/server/auth/logout'
import { jsonSuccess } from '@/lib/api-response'
import { getRefreshToken, clearAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function POST(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authPublic)
  if (rate.limited) return rate.response

  try {
    const refreshToken = getRefreshToken(request)

    if (refreshToken) {
      await logoutSession(refreshToken)
    }

    const response = jsonSuccess(
      { message: 'Logged out successfully.' },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )

    clearAuthCookies(response)
    return response
  } catch (error) {
    console.error('Admin logout error:', error)
    return jsonSuccess(
      { message: 'Logged out.' },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )
  }
}
