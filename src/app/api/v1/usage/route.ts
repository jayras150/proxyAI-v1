// ProxyAI — GET /api/v1/usage
// Billing Milestone 8 — REST API Layer
// Cursor-paginated usage history for the authenticated user.
// Milestone 4: added search, model, status, date range filters.

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { usageQuerySchema } from '@/lib/usage-validation'

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
      search: searchParams.get('search') ?? undefined,
      model: searchParams.get('model') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      date_from: searchParams.get('date_from') ?? undefined,
      date_to: searchParams.get('date_to') ?? undefined,
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
    // Opaque cursor: malformed cursors are treated as "start" (never 500).
    let decodedCursor: { createdAt: Date; id: string } | null = null
    if (parsed.data.cursor) {
      try {
        const raw = JSON.parse(
          Buffer.from(parsed.data.cursor, 'base64url').toString('utf8')
        ) as { createdAt?: string; id?: string }
        const createdAt = raw.createdAt ? new Date(raw.createdAt) : null
        if (raw.id && createdAt && !Number.isNaN(createdAt.getTime())) {
          decodedCursor = { createdAt, id: raw.id }
        }
      } catch {
        decodedCursor = null
      }
    }

    // Build optional filters
    const filters: {
      search?: string
      model?: string
      status?: string
      dateFrom?: Date
      dateTo?: Date
    } = {}
    if (parsed.data.search) filters.search = parsed.data.search
    if (parsed.data.model) filters.model = parsed.data.model
    if (parsed.data.status) filters.status = parsed.data.status
    if (parsed.data.date_from) filters.dateFrom = new Date(parsed.data.date_from)
    if (parsed.data.date_to) filters.dateTo = new Date(parsed.data.date_to)

    const page = await usageRepository.findByUserIdPaginated(
      identity.userId,
      decodedCursor,
      parsed.data.limit ?? 20,
      filters
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
          pricing_version: log.pricingVersionId,
          prompt_tokens: log.promptTokens,
          completion_tokens: log.completionTokens,
          cached_tokens: log.cachedTokens,
          reasoning_tokens: null,
          total_tokens: log.totalTokens,
          user_cost: log.userCost.toFixed(6),
          currency: log.currency,
          latency_ms: log.latencyMs,
          request_id: log.requestId,
          pricing_version_id: log.pricingVersionId,
          input_price: log.inputPrice?.toFixed(6) ?? null,
          output_price: log.outputPrice?.toFixed(6) ?? null,
          markup_percent: log.markupPercent?.toFixed(2) ?? null,
          service_fee: log.serviceFee?.toFixed(6) ?? null,
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
