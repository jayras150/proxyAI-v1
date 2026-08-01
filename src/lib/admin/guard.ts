// ProxyAI — Admin Permission Guard (Milestone 2)
// Reusable guard helper for admin API routes.

import { getAuthenticatedAdmin } from './auth'
import { hasPermission, type AdminPermission } from './permissions'
import type { NextRequest } from 'next/server'
import { AuthError } from '@/lib/errors'

/**
 * Authenticate and check permission for admin API routes.
 * Throws AuthError on failure.
 */
export function requireAdminPermission(
  request: NextRequest,
  permission: AdminPermission
): ReturnType<typeof getAuthenticatedAdmin> {
  const payload = getAuthenticatedAdmin(request)
  if (!hasPermission(payload.role, permission)) {
    throw new AuthError('FORBIDDEN', 'Insufficient permissions.')
  }
  return payload
}
