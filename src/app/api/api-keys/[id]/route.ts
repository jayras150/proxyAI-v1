// ProxyAI — DELETE /api/api-keys/:id, POST /api/api-keys/:id/rotate
// Blueprint Reference: Sprint 9 — API Key APIs
// Milestone 5: added rotate endpoint (internal POST route via ?type=rotate query)

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { revokeApiKey } from '@/server/api-keys/revoke'
import { rotateApiKey } from '@/server/api-keys/rotate'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = await enforceRateLimit(request, RATE_LIMITS.apiKeys)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)
    const { id } = await params

    const action = new URL(request.url).searchParams.get('action')
    if (action !== 'rotate') {
      return jsonError('VALIDATION_ERROR', 'Invalid action. Use ?action=rotate.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const rotated = await rotateApiKey(id, payload.sub)

    return jsonSuccess(rotated, {
      status: 201,
      headers: rateLimitHeaders(rate.result),
    })
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
    if (error instanceof Error && error.message === 'Only active API keys can be rotated.') {
      return jsonError('CONFLICT', error.message, {
        status: 409,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Rotate API key error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
