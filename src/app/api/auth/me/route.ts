// ProxyAI — GET /api/auth/me
// Returns the authenticated user profile (reads HttpOnly access cookie).

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/jwt'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { getAccessToken } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import type { UserProfile } from '@/types/auth'

export async function GET(request: NextRequest) {
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

    let payload
    try {
      payload = verifyAccessToken(accessToken)
    } catch {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    if (!user || user.status === 'SUSPENDED') {
      return jsonError('UNAUTHORIZED', 'Account not found or suspended.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    }

    return jsonSuccess(profile, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    console.error('Get me error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
