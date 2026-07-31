// ProxyAI — GET /api/auth/me
// Returns the authenticated user profile (reads HttpOnly access cookie).

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { toUserProfile, userProfileSelect } from '@/lib/user-profile'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function GET(request: NextRequest) {
  // Rate limit: authenticated endpoint, 300 req/min.
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: userProfileSelect,
    })

    if (!user || user.status === 'SUSPENDED') {
      return jsonError('UNAUTHORIZED', 'Account not found or suspended.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    return jsonSuccess(toUserProfile(user), { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Get me error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
