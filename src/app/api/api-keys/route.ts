// ProxyAI — API Key Routes
// Blueprint Reference: Sprint 9 — API Key APIs
// GET  /api/api-keys    — List API keys
// POST /api/api-keys    — Create API key

import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import type { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { listApiKeys } from '@/server/api-keys/list'
import { createApiKey } from '@/server/api-keys/create'
import { createApiKeySchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthenticatedUser(request)

    // Rate limit keyed by userId (JWT subject), fallback IP.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.apiKeys,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const keys = await listApiKeys(payload.sub)

    return jsonSuccess(keys, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthenticatedUser(request)

    // Rate limit keyed by userId (JWT subject), fallback IP.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.apiKeys,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

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
    return mapApiError(error)
  }
}
