// ProxyAI — Admin Authentication Helpers (Milestone 1)
// Separate admin auth flow: login → TOTP → JWT session.
// Admin uses dedicated endpoints (/api/admin/auth/*) separate from user auth.

import type { NextRequest } from 'next/server'
import { verifyAccessToken, signAccessToken, signRefreshToken } from '@/lib/jwt'
import { getAccessToken, getRefreshToken } from '@/lib/cookies'
import { AuthError } from '@/lib/errors'
import type { JwtPayload } from '@/types/auth'

const ADMIN_TOKEN_EXPIRES_IN = '4h'
const ADMIN_REFRESH_EXPIRES_IN = '24h'

export interface AdminJwtPayload extends JwtPayload {
  /** Whether TOTP has been verified for this session */
  totpVerified?: boolean
}

/**
 * Sign an admin access token.
 */
export function signAdminAccessToken(payload: {
  sub: string
  email: string
  role: string
  totpVerified?: boolean
}): string {
  return signAccessToken({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    totpVerified: payload.totpVerified ?? false,
  })
}

/**
 * Sign an admin refresh token.
 */
export function signAdminRefreshToken(payload: {
  sub: string
  email: string
  role: string
}): string {
  return signRefreshToken({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
  })
}

/**
 * Get the authenticated admin from a request.
 * Throws if not authenticated or not an admin role.
 */
export function getAuthenticatedAdmin(request: NextRequest): AdminJwtPayload {
  const token = getAccessToken(request)
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Missing or invalid authorization header.')
  }

  const payload = verifyAccessToken(token) as AdminJwtPayload

  const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'READ_ONLY']
  if (!adminRoles.includes(payload.role)) {
    throw new AuthError('FORBIDDEN', 'Admin access required.')
  }

  return payload
}

/**
 * Get the admin refresh token from a request.
 */
export function getAdminRefreshToken(request: NextRequest): string | null {
  return getRefreshToken(request)
}

/**
 * Check if the admin has completed TOTP verification.
 */
export function isTotpVerified(payload: AdminJwtPayload): boolean {
  return payload.totpVerified === true
}

/**
 * Require TOTP verification. Throws if not verified.
 */
export function requireTotpVerified(payload: AdminJwtPayload): void {
  if (!isTotpVerified(payload)) {
    throw new AuthError('TOTP_REQUIRED', 'TOTP verification required.')
  }
}
