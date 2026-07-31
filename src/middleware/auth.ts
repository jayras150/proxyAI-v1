// ProxyAI — Auth Middleware (for server-side route protection)
// Blueprint Reference: Sprint 6 — JWT verification

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/jwt'
import { getAccessToken } from '@/lib/cookies'
import type { JwtPayload } from '@/types/auth'

/**
 * Verify the JWT access token from the HttpOnly cookie or Authorization header.
 * Returns the decoded payload on success, or a 401 response on failure.
 */
export function authenticateRequest(
  request: NextRequest
): { user: JwtPayload } | NextResponse {
  const token = getAccessToken(request)

  if (!token) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header.' },
      { status: 401 }
    )
  }

  try {
    const payload = verifyAccessToken(token)
    return { user: payload }
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_TOKEN', message: 'Access token is invalid or expired.' },
      { status: 401 }
    )
  }
}

/**
 * Check if the authenticated user has the required role.
 */
export function requireRole(
  user: JwtPayload,
  allowedRoles: string[]
): boolean {
  return allowedRoles.includes(user.role)
}
