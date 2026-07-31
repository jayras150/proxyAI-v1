// ProxyAI — POST /api/auth/refresh
// Blueprint Reference: Sprint 9 — Authentication APIs
// Rotates the refresh token and sets fresh HttpOnly cookies.

import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens } from '@/server/auth/refresh'
import { AuthError } from '@/lib/errors'
import { refreshSchema } from '@/lib/validation'
import { successResponse, errorResponse } from '@/types/api'
import { getRefreshToken, setAuthCookies } from '@/lib/cookies'

export async function POST(request: NextRequest) {
  try {
    // Prefer the HttpOnly refresh cookie; allow body fallback for API clients.
    const body = await request.json().catch(() => ({}))
    const refreshToken = getRefreshToken(request) ?? body.refreshToken

    if (!refreshToken) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Refresh token is required.'),
        { status: 400 }
      )
    }

    const parsed = refreshSchema.safeParse({ refreshToken })
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', firstError.message),
        { status: 400 }
      )
    }

    const result = await refreshTokens(parsed.data.refreshToken)

    const response = NextResponse.json(
      successResponse({ user: result.user }),
      { status: 200 }
    )

    // Fresh tokens go into HttpOnly cookies (old refresh token already rotated).
    setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      const status =
        error.code === 'REFRESH_TOKEN_EXPIRED' ? 401 :
        error.code === 'ACCOUNT_SUSPENDED' ? 403 : 401
      return NextResponse.json(
        errorResponse(error.code, error.message),
        { status }
      )
    }

    console.error('Token refresh error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
