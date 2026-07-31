// ProxyAI — POST /api/auth/logout
// Blueprint Reference: Sprint 9 — Authentication APIs
// Revokes ONLY the current session (identified by the refresh cookie).

import { NextRequest, NextResponse } from 'next/server'
import { logoutSession } from '@/server/auth/logout'
import { successResponse, errorResponse } from '@/types/api'
import { getRefreshToken, clearAuthCookies } from '@/lib/cookies'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = getRefreshToken(request)

    if (refreshToken) {
      // Revoke only the session that owns this refresh token.
      await logoutSession(refreshToken)
    }

    const response = NextResponse.json(
      successResponse({ message: 'Logged out successfully.' }),
      { status: 200 }
    )

    clearAuthCookies(response)

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
