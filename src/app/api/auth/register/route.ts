// ProxyAI — POST /api/auth/register
// Blueprint Reference: Sprint 9 — Authentication APIs
// Sets HttpOnly cookies for access + refresh tokens. Rate-limited (60/min/IP).

import { NextRequest } from 'next/server'
import { registerUser } from '@/server/auth/register'
import { AuthError } from '@/lib/errors'
import { registerSchema } from '@/lib/validation'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { setAuthCookies } from '@/lib/cookies'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function POST(request: NextRequest) {
  // Rate limit: public endpoint, 60 req/min per IP.
  const rate = await enforceRateLimit(request, RATE_LIMITS.authPublic)
  if (rate.limited) return rate.response

  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const result = await registerUser(parsed.data)

    const response = jsonSuccess({ user: result.user }, {
      status: 201,
      headers: rateLimitHeaders(rate.result),
    })

    // Tokens go into HttpOnly cookies, never the response body.
    setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'EMAIL_EXISTS' ? 409 : 400
      return jsonError(error.code, error.message, { status })
    }

    console.error('Registration error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
