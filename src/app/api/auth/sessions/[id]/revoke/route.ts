// ProxyAI — POST /api/auth/sessions/:id/revoke
// Milestone 6: Revoke a specific session (cannot revoke current session).

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { getRefreshToken } from '@/lib/cookies'
import { hashToken } from '@/lib/crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)
    const { id } = await params

    // Prevent revoking current session
    const currentRefreshToken = getRefreshToken(request)
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null

    const session = await prisma.session.findFirst({
      where: { id, userId: payload.sub },
    })

    if (!session) {
      return jsonError('NOT_FOUND', 'Session not found.', {
        status: 404,
        headers: rateLimitHeaders(rate.result),
      })
    }

    if (currentHash && session.refreshTokenHash === currentHash) {
      return jsonError('VALIDATION_ERROR', 'Cannot revoke your current session. Use logout instead.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    await prisma.session.delete({
      where: { id },
    })

    return jsonSuccess(
      { message: 'Session revoked.' },
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
    console.error('Revoke session error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
