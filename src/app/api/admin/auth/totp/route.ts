// ProxyAI — POST /api/admin/auth/totp
// Verify TOTP token after initial login. Returns fully authenticated token.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { setAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { getAuthenticatedAdmin, signAdminAccessToken } from '@/lib/admin/auth'
import { verifyTotpToken } from '@/lib/admin/totp'
import { mapApiError } from '@/lib/api-error-mapper'
import { z } from 'zod'

const totpSchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
})

export async function POST(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedAdmin(request)

    // Already verified?
    if (payload.totpVerified) {
      return jsonSuccess({ message: 'TOTP already verified.' }, { headers: rateLimitHeaders(rate.result) })
    }

    const body = await request.json()
    const parsed = totpSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Get stored secret
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { totpSecret: true },
    })

    if (!user?.totpSecret) {
      return jsonError('TOTP_NOT_CONFIGURED', 'TOTP is not configured for this account.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Verify TOTP
    const isValid = verifyTotpToken(user.totpSecret, parsed.data.token)
    if (!isValid) {
      return jsonError('INVALID_TOTP', 'Invalid TOTP code.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Issue fully verified token
    const accessToken = signAdminAccessToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      totpVerified: true,
    })

    const response = jsonSuccess(
      {
        message: 'TOTP verified.',
        user: { id: payload.sub, email: payload.email, role: payload.role },
      },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )

    setAuthCookies(response, accessToken, '')
    return response
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
