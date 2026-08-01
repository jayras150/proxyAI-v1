// ProxyAI — GET /api/admin/auth/me
// Returns current admin user profile (with TOTP status).

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { getAuthenticatedAdmin } from '@/lib/admin/auth'
import { toUserProfile, userProfileSelect } from '@/lib/user-profile'
import { getPermissionsForRole } from '@/lib/admin/permissions'

export async function GET(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedAdmin(request)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...userProfileSelect, totpSecret: true },
    })

    if (!user || user.status === 'SUSPENDED') {
      return jsonError('UNAUTHORIZED', 'Account not found or suspended.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const permissions = getPermissionsForRole(user.role)

    return jsonSuccess(
      {
        ...toUserProfile(user),
        totp_enabled: !!user.totpSecret,
        totp_verified: payload.totpVerified ?? false,
        permissions,
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
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Admin me error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
