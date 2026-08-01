// ProxyAI — GET /api/auth/sessions
// Milestone 6: List active sessions for the authenticated user.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { getRefreshToken } from '@/lib/cookies'
import { hashToken } from '@/lib/crypto'

export async function GET(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)

    // Identify current session by refresh token hash
    const currentRefreshToken = getRefreshToken(request)
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null

    const sessions = await prisma.session.findMany({
      where: {
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        refreshTokenHash: true,
      },
    })

    return jsonSuccess(
      sessions.map((s) => ({
        id: s.id,
        is_current: currentHash === s.refreshTokenHash,
        user_agent: s.userAgent,
        ip_address: s.ipAddress
          ? `${s.ipAddress.slice(0, Math.max(0, s.ipAddress.lastIndexOf('.')))}.xxx`
          : null,
        created_at: s.createdAt.toISOString(),
        expires_at: s.expiresAt.toISOString(),
      })),
      { headers: rateLimitHeaders(rate.result) }
    )
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
    console.error('Sessions error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
