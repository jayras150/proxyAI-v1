// ProxyAI — GET /api/v1/usage
// Billing Milestone 8 — REST API Layer
// Cursor-paginated usage history for the authenticated user.

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { usageQuerySchema } from '@/lib/ai-validation'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/usage'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = usageQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
      )
      return jsonError('VALIDATION_ERROR', 'Invalid query parameters.', {
        status: 400,
        details,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const { usageRepository } = getApiServices()
    const decodedCursor = parsed.data.cursor
      ? (JSON.parse(Buffer.from(parsed.data.cursor, 'base64url').toString('utf8')) as {
          createdAt: string
          id: string
        })
      : null
    const page = await usageRepository.findByUserIdPaginated(
      identity.userId,
      decodedCursor ? { createdAt: new Date(decodedCursor.createdAt), id: decodedCursor.id } : null,
      parsed.data.limit ?? 20
    )

    logApiRequest({
      endpoint,
      correlationId,
      userId: identity.userId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    const encodeCursor = (c: { createdAt: Date; id: string }) =>
      Buffer.from(JSON.stringify({ createdAt: c.createdAt.toISOString(), id: c.id })).toString(
        'base64url'
      )

    return jsonSuccess(
      {
        items: page.items.map((log) => ({
          id: log.id,
          model: log.model,
          provider: log.provider,
          status: log.status,
          prompt_tokens: log.promptTokens,
          completion_tokens: log.completionTokens,
          cached_tokens: log.cachedTokens,
          total_tokens: log.totalTokens,
          user_cost: log.userCost.toFixed(6),
          currency: log.currency,
          request_id: log.requestId,
          created_at: log.createdAt.toISOString(),
        })),
        next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
        has_more: page.hasMore,
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint,
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
