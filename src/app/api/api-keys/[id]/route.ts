// ProxyAI — DELETE /api/api-keys/:id
// Blueprint Reference: Sprint 9 — API Key APIs

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { revokeApiKey } from '@/server/api-keys/revoke'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: authenticated endpoint, 300 req/min.
  const rate = await enforceRateLimit(request, RATE_LIMITS.apiKeys)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)
    const { id } = await params

    await revokeApiKey(id, payload.sub)

    return jsonSuccess(
      { message: 'API key revoked.' },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    if (error instanceof Error && error.message === 'API key not found') {
      return jsonError('NOT_FOUND', 'API key not found.', {
        status: 404,
        headers: rateLimitHeaders(rate.result),
      })
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Revoke API key error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
