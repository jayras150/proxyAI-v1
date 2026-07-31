// ProxyAI — Authenticated Request Helper (shared)
// The single auth pattern for protected routes: read the token (cookie or
// Bearer header), verify it, return the JWT payload. Throws AuthError when
// no token is present; throws JsonWebTokenError when verification fails.

import type { NextRequest } from 'next/server'
import { getAccessToken } from '@/lib/cookies'
import { verifyAccessToken } from '@/lib/jwt'
import { AuthError } from '@/lib/errors'
import type { JwtPayload } from '@/types/auth'

/**
 * Resolve the authenticated user for a request.
 *
 * @throws AuthError          — missing/invalid authorization header
 * @throws JsonWebTokenError  — token invalid or expired
 */
export function getAuthenticatedUser(request: NextRequest): JwtPayload {
  const token = getAccessToken(request)
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Missing or invalid authorization header.')
  }

  return verifyAccessToken(token)
}
