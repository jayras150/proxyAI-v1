// ProxyAI — POST /api/auth/logout-all
// Revokes ALL sessions for the authenticated user.

import { NextRequest, NextResponse } from 'next/server'
import { logoutAllSessions } from '@/server/auth/logout'
import { verifyAccessToken } from '@/lib/jwt'
import { successResponse, errorResponse } from '@/types/api'
import { getAccessToken, clearAuthCookies } from '@/lib/cookies'

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request)
    if (!accessToken) {
      return NextResponse.json(
        errorResponse('UNAUTHORIZED', 'Missing or invalid authorization header.'),
        { status: 401 }
      )
    }

    const payload = verifyAccessToken(accessToken)

    await logoutAllSessions(payload.sub)

    const response = NextResponse.json(
      successResponse({ message: 'All sessions revoked.' }),
      { status: 200 }
    )

    clearAuthCookies(response)

    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Access token is invalid or expired.'),
        { status: 401 }
      )
    }

    console.error('Logout-all error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
