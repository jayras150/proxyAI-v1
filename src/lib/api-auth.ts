// ProxyAI — API Authentication Helper (JWT or API key)
// Billing Milestone 8 — REST API Layer
//
// Unified identity resolution for the v1 API:
//   1. `Authorization: Bearer pk_live_...`  → API key (owner = userId)
//   2. `Authorization: Bearer <jwt>`        → access token
//   3. `proxyai_access` cookie              → access token
//
// Roles: the JWT carries the user role ('USER' | 'ADMIN' | 'SUPER_ADMIN');
// API-key identities resolve to 'USER' (admin keys are not modeled in V1).

import type { NextRequest } from 'next/server'
import { hashApiKey } from '@/lib/crypto'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import type { ApiKeyRepository } from '@/server/api-keys/api-key.repository'

export const API_KEY_PREFIX = 'pk_live_'

export interface ApiIdentity {
  userId: string
  role: string
  authMethod: 'jwt' | 'api_key'
  apiKeyId?: string
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

/**
 * Resolve the caller identity from an API key or access token.
 * @throws AuthError            — missing/invalid credentials
 * @throws JsonWebTokenError   — JWT invalid or expired
 */
export async function authenticateRequest(
  request: NextRequest,
  apiKeyRepository: ApiKeyRepository
): Promise<ApiIdentity> {
  const token = bearerToken(request)

  // 1. API key path (OpenAI-style: Bearer pk_live_...).
  if (token && token.startsWith(API_KEY_PREFIX)) {
    const apiKey = await apiKeyRepository.findByHash(hashApiKey(token))
    if (!apiKey || apiKey.status !== 'ACTIVE') {
      throw new AuthError('UNAUTHORIZED', 'Invalid API key.')
    }
    await apiKeyRepository.touchLastUsed(apiKey.id).catch(() => undefined)
    return {
      userId: apiKey.userId,
      role: 'USER', // admin keys are not modeled in V1
      authMethod: 'api_key',
      apiKeyId: apiKey.id,
    }
  }

  // 2. JWT path (Bearer access token or HttpOnly cookie).
  const payload = getAuthenticatedUser(request)
  return {
    userId: payload.sub,
    role: payload.role,
    authMethod: 'jwt',
  }
}

/** 403 gate: the caller must hold one of the allowed roles. */
export function requireRole(identity: ApiIdentity, allowedRoles: readonly string[]): void {
  if (!allowedRoles.includes(identity.role)) {
    throw new AuthError(
      'FORBIDDEN',
      `Role ${identity.role} is not allowed. Requires one of: ${allowedRoles.join(', ')}.`
    )
  }
}
