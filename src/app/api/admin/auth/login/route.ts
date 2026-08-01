// ProxyAI — POST /api/admin/auth/login
// Admin login: verify credentials → check role → check TOTP requirement.
// Returns session with totp_required flag if TOTP is needed.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { setAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { signAdminAccessToken, signAdminRefreshToken } from '@/lib/admin/auth'
import { hasTotpEnabled } from '@/lib/admin/totp'
import { isAdminRole } from '@/lib/admin/permissions'
import { createSession } from '@/server/auth/session'
import { z } from 'zod'

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authPublic)
  if (rate.limited) return rate.response

  try {
    const body = await request.json()
    const parsed = adminLoginSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, role: true, status: true, passwordHash: true },
    })

    if (!user) {
      return jsonError('INVALID_CREDENTIALS', 'Invalid email or password.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    if (user.status !== 'ACTIVE') {
      return jsonError('ACCOUNT_SUSPENDED', 'Account is suspended.', {
        status: 403,
        headers: rateLimitHeaders(rate.result),
      })
    }

    if (!isAdminRole(user.role)) {
      return jsonError('FORBIDDEN', 'Admin access required.', {
        status: 403,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Verify password
    const valid = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!valid) {
      return jsonError('INVALID_CREDENTIALS', 'Invalid email or password.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Check if TOTP is enabled
    const totpRequired = await hasTotpEnabled(user.id)

    if (totpRequired) {
      // Issue limited token (no TOTP yet) — client must complete TOTP step
      const tempToken = signAdminAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        totpVerified: false,
      })
      const refreshToken = signAdminRefreshToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      })

      // Create session
      await createSession(user.id, refreshToken)

      const response = jsonSuccess(
        {
          totp_required: true,
          message: 'TOTP verification required.',
        },
        { status: 200, headers: rateLimitHeaders(rate.result) }
      )

      setAuthCookies(response, tempToken, refreshToken)
      return response
    }

    // No TOTP — full access
    const accessToken = signAdminAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      totpVerified: false,
    })
    const refreshToken = signAdminRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    await createSession(user.id, refreshToken)

    const response = jsonSuccess(
      {
        totp_required: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200, headers: rateLimitHeaders(rate.result) }
    )

    setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Admin login error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
