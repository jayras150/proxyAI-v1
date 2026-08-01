// ProxyAI — POST /api/auth/change-password
// Milestone 6: Change password with current password verification.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { z } from 'zod'
import { hashPassword, verifyPassword } from '@/lib/password'

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
}).refine((data) => data.current_password !== data.new_password, {
  message: 'New password must be different from current password',
  path: ['new_password'],
})

export async function POST(request: NextRequest) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.authAuthenticated)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)

    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Verify current password
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordHash: true },
    })

    if (!user) {
      return jsonError('NOT_FOUND', 'User not found.', {
        status: 404,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const isValid = await verifyPassword(parsed.data.current_password, user.passwordHash)
    if (!isValid) {
      return jsonError('VALIDATION_ERROR', 'Current password is incorrect.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    // Update password
    const newHash = await hashPassword(parsed.data.new_password)
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash: newHash },
    })

    return jsonSuccess(
      { message: 'Password updated successfully.' },
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
    console.error('Change password error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
