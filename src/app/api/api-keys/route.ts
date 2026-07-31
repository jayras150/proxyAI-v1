// ProxyAI — API Key Routes
// Blueprint Reference: Sprint 9 — API Key APIs
// GET  /api/api-keys    — List API keys
// POST /api/api-keys    — Create API key

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { AuthError } from '@/lib/errors'
import { listApiKeys } from '@/server/api-keys/list'
import { createApiKey } from '@/server/api-keys/create'
import { createApiKeySchema } from '@/lib/validation'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'

export async function GET(request: NextRequest) {
  // Rate limit: authenticated endpoint, 300 req/min.
  const rate = await enforceRateLimit(request, RATE_LIMITS.apiKeys)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)
    const keys = await listApiKeys(payload.sub)

    return jsonSuccess(keys, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('List API keys error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Rate limit: authenticated endpoint, 300 req/min.
  const rate = await enforceRateLimit(request, RATE_LIMITS.apiKeys)
  if (rate.limited) return rate.response

  try {
    const payload = getAuthenticatedUser(request)
    const body = await request.json()

    const parsed = createApiKeySchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const key = await createApiKey(payload.sub, parsed.data.name)

    return jsonSuccess(key, { status: 201, headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message, {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        headers: rateLimitHeaders(rate.result),
      })
    }
    console.error('Create API key error:', error)
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', { status: 500 })
  }
}
