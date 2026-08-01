// ProxyAI — GET /api/admin/auth/session
// Returns admin session information (current).

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { getAuthenticatedAdmin } from '@/lib/admin/auth'
import { getRefreshToken } from '@/lib/cookies'
import { hashToken } from '@/lib/crypto'
import { mapApiError } from '@/lib/api-error-mapper'

export async function GET(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedAdmin(request)

    const currentRefreshToken = getRefreshToken(request)
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null

    let session = null
    if (currentHash) {
      session = await prisma.session.findFirst({
        where: {
          userId: payload.sub,
          refreshTokenHash: currentHash,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          userAgent: true,
          ipAddress: true,
        },
      })
    }

    return jsonSuccess(
      {
        id: session?.id ?? null,
        user_id: payload.sub,
        email: payload.email,
        role: payload.role,
        totp_verified: payload.totpVerified ?? false,
        created_at: session?.createdAt.toISOString() ?? null,
        expires_at: session?.expiresAt.toISOString() ?? null,
        ip_address: session?.ipAddress ?? null,
        user_agent: session?.userAgent ?? null,
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    return mapApiError(error)
  }
}
