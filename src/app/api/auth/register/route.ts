// ProxyAI — POST /api/auth/register
// Blueprint Reference: Sprint 9 — Authentication APIs
// Sets HttpOnly cookies for access + refresh tokens.

import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/server/auth/register'
import { AuthError } from '@/lib/errors'
import { registerSchema } from '@/lib/validation'
import { successResponse, errorResponse } from '@/types/api'
import { setAuthCookies } from '@/lib/cookies'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', firstError.message),
        { status: 400 }
      )
    }

    const result = await registerUser(parsed.data)

    const response = NextResponse.json(
      successResponse({ user: result.user }),
      { status: 201 }
    )

    // Tokens go into HttpOnly cookies, never the response body.
    setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'EMAIL_EXISTS' ? 409 : 400
      return NextResponse.json(
        errorResponse(error.code, error.message),
        { status }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
